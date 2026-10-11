import { db } from '../db';

/** Known settings and the type of their value. */
export interface SettingsMap {
  /** Account preselected when adding a movement. */
  lastAccountId: string;
}

export type SettingKey = keyof SettingsMap;

export const settingsRepo = {
  async get<K extends SettingKey>(key: K): Promise<SettingsMap[K] | null> {
    const row = await db.settings.get(key);
    return row ? (row.value as SettingsMap[K]) : null;
  },

  async set<K extends SettingKey>(key: K, value: SettingsMap[K]): Promise<void> {
    await db.settings.put({ key, value });
  },
};
