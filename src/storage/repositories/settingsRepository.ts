import { AppSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../utils/storage';
import { dbGet, dbPut, STORES } from '../db';

interface SettingsRow {
  key: string;
  value: AppSettings;
  updatedAt: string;
}

export const settingsRepository = {
  async getSettings(): Promise<AppSettings> {
    const row = await dbGet<SettingsRow>(STORES.SETTINGS, 'app_settings');
    if (!row || !row.value) {
      return DEFAULT_SETTINGS;
    }
    return {
      ...DEFAULT_SETTINGS,
      ...row.value,
      d1Config: {
        ...DEFAULT_SETTINGS.d1Config,
        ...(row.value.d1Config || {}),
      },
    };
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    const row: SettingsRow = {
      key: 'app_settings',
      value: settings,
      updatedAt: new Date().toISOString(),
    };
    await dbPut(STORES.SETTINGS, row);
  },
};
