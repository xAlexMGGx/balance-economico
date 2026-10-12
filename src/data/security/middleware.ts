import type { DBCore, DBCoreCursor, DBCoreTable, DBCoreTableSchema, Middleware } from 'dexie';
import { decryptJson, encryptJson } from './crypto';
import { keyring, LockedError } from './keyring';

/**
 * Tables whose records are encrypted when the lock is on. The fields the database needs to search
 * and sort (primary key and indexes: ids, dates, order) stay readable; everything else (names,
 * amounts, titles, colours, icons…) is stored as one encrypted payload.
 */
export const ENCRYPTED_TABLES = new Set(['accounts', 'groups', 'categories', 'tags', 'transactions', 'recurringRules']);

const PAYLOAD = '__enc';

type Row = Record<string, unknown>;

function searchableFields(schema: DBCoreTableSchema): Set<string> {
  const fields = new Set<string>();
  for (const index of [schema.primaryKey, ...schema.indexes]) {
    const keyPath = index.keyPath;
    if (typeof keyPath === 'string') fields.add(keyPath);
    else if (Array.isArray(keyPath)) keyPath.forEach((k) => fields.add(k));
  }
  return fields;
}

function encryptRecord(record: Row, searchable: ReadonlySet<string>): Row {
  if (!keyring.encrypting) return record;
  const key = keyring.key;
  if (!key) throw new LockedError(); // never write protected data in the clear
  const visible: Row = {};
  const secret: Row = {};
  for (const [field, value] of Object.entries(record)) {
    if (searchable.has(field)) visible[field] = value;
    else secret[field] = value;
  }
  return { ...visible, [PAYLOAD]: encryptJson(key, secret) };
}

/** Records written before the lock was turned on have no payload and are returned as they are. */
function decryptRecord(record: unknown): unknown {
  if (typeof record !== 'object' || record === null || !(PAYLOAD in record)) return record;
  const key = keyring.key;
  if (!key) throw new LockedError();
  const { [PAYLOAD]: payload, ...visible } = record as Row;
  return { ...visible, ...(decryptJson(key, payload as Uint8Array) as Row) };
}

/** A cursor whose `value` is decrypted on read. */
function decryptingCursor(cursor: DBCoreCursor): DBCoreCursor {
  return Object.create(cursor, {
    value: { get: () => decryptRecord(cursor.value) },
  }) as DBCoreCursor;
}

function encryptingTable(table: DBCoreTable): DBCoreTable {
  const searchable = searchableFields(table.schema);
  return {
    ...table,
    mutate: (req) =>
      req.type === 'add' || req.type === 'put'
        ? table.mutate({ ...req, values: req.values.map((v) => encryptRecord(v as Row, searchable)) })
        : table.mutate(req),
    get: (req) => table.get(req).then(decryptRecord),
    getMany: (req) => table.getMany(req).then((records) => records.map(decryptRecord)),
    query: (req) =>
      table.query(req).then((res) => (req.values ? { ...res, result: res.result.map(decryptRecord) } : res)),
    openCursor: (req) =>
      table.openCursor(req).then((cursor) => (cursor && req.values ? decryptingCursor(cursor) : cursor)),
  };
}

/** Dexie middleware that encrypts and decrypts records on their way to and from IndexedDB. */
export const encryptionMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'encryption',
  create: (down) => ({
    ...down,
    table: (name) => {
      const table = down.table(name);
      return ENCRYPTED_TABLES.has(name) ? encryptingTable(table) : table;
    },
  }),
};
