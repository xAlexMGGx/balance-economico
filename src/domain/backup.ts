import { isValidISODate, isValidYearMonth, toISODate } from './dates';
import type {
  Account,
  Category,
  Group,
  RecurringOccurrence,
  RecurringRule,
  Setting,
  Tag,
  Transaction,
} from './types';

// Backup files: every table of the database in one JSON document.

export const BACKUP_FORMAT = 'balance-economico-backup';
/** Bump when the shape of the data changes, and teach `parseBackup` to read the older versions. */
export const BACKUP_VERSION = 1;

export interface BackupData {
  accounts: Account[];
  groups: Group[];
  categories: Category[];
  tags: Tag[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  recurringOccurrences: RecurringOccurrence[];
  settings: Setting[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO timestamp. */
  exportedAt: string;
  data: BackupData;
}

export function createBackup(data: BackupData, exportedAt: Date): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: exportedAt.toISOString(), data };
}

/** "balance-copia-2026-10-11.json", with the local date. */
export function backupFileName(exportedAt: Date): string {
  return `balance-copia-${toISODate(exportedAt)}.json`;
}

export interface BackupSummary {
  accounts: number;
  groups: number;
  categories: number;
  tags: number;
  transactions: number;
  recurringRules: number;
}

export function summarizeBackup(data: BackupData): BackupSummary {
  return {
    accounts: data.accounts.length,
    groups: data.groups.length,
    categories: data.categories.length,
    tags: data.tags.length,
    transactions: data.transactions.length,
    recurringRules: data.recurringRules.length,
  };
}

// --- Reading a file ----------------------------------------------------------------------

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

const NOT_A_BACKUP = 'El archivo no es una copia de seguridad de esta app.';

class InvalidBackup extends Error {}

type Row = Record<string, unknown>;

const isObject = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isInteger = (value: unknown): value is number => Number.isInteger(value);
const isNullOr = (check: (value: unknown) => boolean) => (value: unknown) => value === null || check(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isTxType = (value: unknown) => value === 'expense' || value === 'income';

/** Fails with a message that says which record is wrong, so a damaged file is easy to spot. */
function expect(condition: boolean, what: string, index: number, field: string): void {
  if (!condition) throw new InvalidBackup(`La copia tiene datos que no son válidos (${what} ${index + 1}: ${field}).`);
}

function rows(data: Row, table: keyof BackupData): Row[] {
  const value = data[table];
  if (!Array.isArray(value) || !value.every(isObject)) throw new InvalidBackup(NOT_A_BACKUP);
  return value;
}

function checkUniqueIds(list: Row[], what: string): Set<string> {
  const ids = new Set<string>();
  list.forEach((row, i) => {
    expect(isNonEmptyString(row.id), what, i, 'id');
    expect(!ids.has(row.id as string), what, i, 'id repetido');
    ids.add(row.id as string);
  });
  return ids;
}

function checkMeta(row: Row, what: string, i: number): void {
  expect(isString(row.createdAt) && isString(row.updatedAt), what, i, 'fechas de registro');
}

/** Validates every table and the links between them (a movement's account must exist, and so on). */
function validateData(data: Row): BackupData {
  const accounts = rows(data, 'accounts');
  const groups = rows(data, 'groups');
  const categories = rows(data, 'categories');
  const tags = rows(data, 'tags');
  const transactions = rows(data, 'transactions');
  const recurringRules = rows(data, 'recurringRules');
  const recurringOccurrences = rows(data, 'recurringOccurrences');
  const settings = rows(data, 'settings');

  if (accounts.length === 0) throw new InvalidBackup('La copia no tiene ninguna cuenta.');

  const accountIds = checkUniqueIds(accounts, 'cuenta');
  accounts.forEach((a, i) => {
    checkMeta(a, 'cuenta', i);
    expect(isNonEmptyString(a.name), 'cuenta', i, 'nombre');
    expect(isString(a.color), 'cuenta', i, 'color');
    expect(isInteger(a.initialBalance), 'cuenta', i, 'saldo inicial');
    expect(typeof a.countsForSavings === 'boolean', 'cuenta', i, 'cuenta para ahorro');
    expect(typeof a.order === 'number', 'cuenta', i, 'orden');
  });

  const groupIds = checkUniqueIds(groups, 'grupo');
  groups.forEach((g, i) => {
    checkMeta(g, 'grupo', i);
    expect(isNonEmptyString(g.name), 'grupo', i, 'nombre');
    expect(isString(g.color), 'grupo', i, 'color');
    expect(typeof g.order === 'number', 'grupo', i, 'orden');
  });

  checkUniqueIds(categories, 'categoría');
  const categoryTypes = new Map<string, unknown>();
  categories.forEach((c, i) => {
    checkMeta(c, 'categoría', i);
    expect(isNonEmptyString(c.name), 'categoría', i, 'nombre');
    expect(isString(c.color) && isString(c.icon), 'categoría', i, 'color o icono');
    expect(isTxType(c.type), 'categoría', i, 'tipo');
    expect(
      c.type === 'income' ? c.groupId === null : isString(c.groupId) && groupIds.has(c.groupId),
      'categoría',
      i,
      'grupo',
    );
    expect(typeof c.order === 'number', 'categoría', i, 'orden');
    categoryTypes.set(c.id as string, c.type);
  });

  const tagIds = checkUniqueIds(tags, 'tag');
  tags.forEach((t, i) => {
    checkMeta(t, 'tag', i);
    expect(isNonEmptyString(t.name), 'tag', i, 'nombre');
    expect(typeof t.order === 'number', 'tag', i, 'orden');
  });

  const ruleIds = checkUniqueIds(recurringRules, 'regla');
  recurringRules.forEach((r, i) => {
    checkMeta(r, 'regla', i);
    expect(isTxType(r.type), 'regla', i, 'tipo');
    expect(isInteger(r.amount) && (r.amount as number) > 0, 'regla', i, 'importe');
    expect(isInteger(r.dayOfMonth) && (r.dayOfMonth as number) >= 1 && (r.dayOfMonth as number) <= 31, 'regla', i, 'día');
    expect(isString(r.accountId) && accountIds.has(r.accountId), 'regla', i, 'cuenta');
    expect(isString(r.categoryId) && categoryTypes.get(r.categoryId) === r.type, 'regla', i, 'categoría');
    expect(isNullOr(isString)(r.title), 'regla', i, 'título');
    expect(isStringArray(r.tagIds) && r.tagIds.every((id) => tagIds.has(id)), 'regla', i, 'tags');
    expect(isString(r.startMonth) && isValidYearMonth(r.startMonth), 'regla', i, 'mes de inicio');
    expect(r.endMonth === null || (isString(r.endMonth) && isValidYearMonth(r.endMonth)), 'regla', i, 'mes de fin');
  });

  checkUniqueIds(transactions, 'movimiento');
  transactions.forEach((t, i) => {
    checkMeta(t, 'movimiento', i);
    expect(isTxType(t.type), 'movimiento', i, 'tipo');
    expect(isInteger(t.amount) && (t.amount as number) > 0, 'movimiento', i, 'importe');
    expect(isString(t.date) && isValidISODate(t.date), 'movimiento', i, 'fecha');
    expect(isString(t.accountId) && accountIds.has(t.accountId), 'movimiento', i, 'cuenta');
    expect(isString(t.categoryId) && categoryTypes.get(t.categoryId) === t.type, 'movimiento', i, 'categoría');
    expect(isNullOr(isString)(t.title), 'movimiento', i, 'título');
    expect(isStringArray(t.tagIds) && t.tagIds.every((id) => tagIds.has(id)), 'movimiento', i, 'tags');
    // A movement may outlive its rule (deleting a rule keeps what it generated), so the rule id is not checked.
    expect(isNullOr(isString)(t.recurringRuleId), 'movimiento', i, 'regla');
    expect(t.recurringMonth === null || (isString(t.recurringMonth) && isValidYearMonth(t.recurringMonth)), 'movimiento', i, 'mes');
  });

  const occurrenceKeys = new Set<string>();
  recurringOccurrences.forEach((o, i) => {
    expect(isString(o.ruleId) && ruleIds.has(o.ruleId), 'mes generado', i, 'regla');
    expect(isString(o.month) && isValidYearMonth(o.month), 'mes generado', i, 'mes');
    // The movement may have been deleted on purpose: that is what stops it from coming back.
    expect(isString(o.transactionId), 'mes generado', i, 'movimiento');
    const key = `${o.ruleId as string}|${o.month as string}`;
    expect(!occurrenceKeys.has(key), 'mes generado', i, 'repetido');
    occurrenceKeys.add(key);
  });

  settings.forEach((s, i) => expect(isNonEmptyString(s.key) && 'value' in s, 'ajuste', i, 'clave'));

  return { accounts, groups, categories, tags, transactions, recurringRules, recurringOccurrences, settings } as unknown as BackupData;
}

/** Reads and validates the text of a backup file. Never throws. */
export function parseBackup(text: string): ParseResult {
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new InvalidBackup(NOT_A_BACKUP);
    }
    if (!isObject(raw) || raw.format !== BACKUP_FORMAT || !isInteger(raw.version) || !isObject(raw.data)) {
      throw new InvalidBackup(NOT_A_BACKUP);
    }
    if (raw.version > BACKUP_VERSION) {
      throw new InvalidBackup('Esta copia se hizo con una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.');
    }
    if (!isString(raw.exportedAt) || Number.isNaN(Date.parse(raw.exportedAt))) throw new InvalidBackup(NOT_A_BACKUP);
    // Version 1 is the only one so far; older versions would be migrated here.
    const data = validateData(raw.data);
    return { ok: true, backup: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: raw.exportedAt, data } };
  } catch (error) {
    if (error instanceof InvalidBackup) return { ok: false, error: error.message };
    return { ok: false, error: NOT_A_BACKUP };
  }
}

// --- Reminder ----------------------------------------------------------------------------

export const BACKUP_REMINDER_DAYS = 7;
export const BACKUP_SNOOZE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between an ISO timestamp and now; null without a timestamp. */
export function daysSince(timestamp: string | null, now: Date): number | null {
  if (!timestamp) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(timestamp)) / DAY_MS));
}

/** Whether to remind the user to make a backup: there is something to lose and the last copy is old or missing. */
export function isBackupReminderDue({
  hasData,
  lastBackupAt,
  snoozedUntil,
  now,
}: {
  hasData: boolean;
  lastBackupAt: string | null;
  snoozedUntil: string | null;
  now: Date;
}): boolean {
  if (!hasData) return false;
  if (snoozedUntil && Date.parse(snoozedUntil) > now.getTime()) return false;
  const days = daysSince(lastBackupAt, now);
  return days === null || days >= BACKUP_REMINDER_DAYS;
}

export function snoozeUntil(now: Date): string {
  return new Date(now.getTime() + BACKUP_SNOOZE_DAYS * DAY_MS).toISOString();
}
