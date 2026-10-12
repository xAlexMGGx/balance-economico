// Public entry point of the data layer. Screens import from here, never from `db.ts`.
export { accountsRepo } from './repositories/accounts';
export { groupsRepo } from './repositories/groups';
export { categoriesRepo } from './repositories/categories';
export { tagsRepo } from './repositories/tags';
export { transactionsRepo } from './repositories/transactions';
export { recurringRepo } from './repositories/recurring';
export { backupRepo } from './repositories/backup';
export { securityRepo } from './repositories/security';
export { LockedError, type LockStatus } from './security/keyring';
export { FaceIdError, isPasskeySupported, type FaceIdProblem } from './security/webauthn';
export { LOCK_AFTER_MS, MIN_PASSWORD_LENGTH } from './security/config';
export { settingsRepo, type SettingKey, type SettingsMap } from './repositories/settings';
export { RepositoryError, isInUse, type Usage } from './repositories/common';
export * from './hooks';
export { requestPersistentStorage } from './storage';
