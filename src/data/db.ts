import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Account,
  Category,
  Group,
  RecurringOccurrence,
  RecurringRule,
  Setting,
  Tag,
  Transaction,
} from '../domain/types';
import type { SecurityConfig } from './security/config';
import { encryptionMiddleware } from './security/middleware';
import { createDefaultAccounts } from './seed';

/**
 * IndexedDB schema. Only the repositories import this file.
 * To change the schema, add a new `this.version(n)` below; never edit an existing version.
 */
export class BalanceDB extends Dexie {
  declare accounts: EntityTable<Account, 'id'>;
  declare groups: EntityTable<Group, 'id'>;
  declare categories: EntityTable<Category, 'id'>;
  declare tags: EntityTable<Tag, 'id'>;
  declare transactions: EntityTable<Transaction, 'id'>;
  declare recurringRules: EntityTable<RecurringRule, 'id'>;
  declare recurringOccurrences: Table<RecurringOccurrence, [string, string]>;
  declare settings: EntityTable<Setting, 'key'>;
  declare security: EntityTable<SecurityConfig, 'id'>;

  constructor() {
    super('balance-economico');

    this.version(1).stores({
      accounts: 'id, order',
      groups: 'id, order',
      categories: 'id, type, groupId, order',
      tags: 'id, order',
      transactions: 'id, date, accountId, categoryId, *tagIds, [recurringRuleId+recurringMonth]',
      recurringRules: 'id, accountId, categoryId, *tagIds',
      recurringOccurrences: '[ruleId+month], ruleId',
      settings: 'key',
    });

    // App lock settings: wrapped data keys and the Face ID passkey. Never encrypted, never in backups.
    this.version(2).stores({
      security: 'id',
    });

    // Runs only once, when the database is created for the first time.
    this.on('populate', (tx) => tx.table('accounts').bulkAdd(createDefaultAccounts()));

    // Encrypts and decrypts records when the app lock is on (see security/middleware.ts).
    this.use(encryptionMiddleware);
  }
}

export const db = new BalanceDB();
