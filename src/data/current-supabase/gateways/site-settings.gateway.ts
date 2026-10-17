import type { SiteManagementGateway } from '../../contracts/site-management.gateway';
import type { SettingsGateway } from '../../contracts/settings.gateway';
import type { GatewayPage, GatewayQuery } from '../../contracts/common.gateway';
import type { SiteManagementViewModel } from '../../../features/siteManagement/types';
import type { SettingsViewModel } from '../../../features/settings/types';
import { createTableGateway } from '../tableGateway';
import { settingsCurrenciesApiGateway } from '../../http/settings-currencies-api.gateway';

export const currentSupabaseSiteManagementGateway: SiteManagementGateway = createTableGateway<SiteManagementViewModel>('announcements', 'announcement_id', ['announcement_id'], (row) => ({ siteId: String(row.announcement_id ?? '') }));

// public.settings كان مستند jsonb وأُسقط: كل فئة إعدادات تعيش في جدولها المسطّح ويُقرأ عبر /api/v1/settings.
// public.settings was a jsonb document and is dropped: each category owns a flat table read through /api/v1/settings.
const SETTINGS_CATEGORIES = ['general', 'logistics', 'whatsapp', 'print_template'] as const;
type SettingsCategoryName = (typeof SETTINGS_CATEGORIES)[number];

async function readCategory(category: SettingsCategoryName): Promise<SettingsViewModel | null> {
  try {
    const record = await settingsCurrenciesApiGateway.getSettings(category);
    return {
      id: record.settingId,
      settingId: record.settingId,
      category: record.category,
      settings: record.settings,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
    };
  } catch {
    // فئة بلا صف محفوظ: تُعامل كغياب لا كخطأ، فلا تنكسر القائمة عند أول استخدام.
    // A category with no stored row is an absence, not an error, so an empty table never breaks the list.
    return null;
  }
}

export const currentSupabaseSettingsGateway: SettingsGateway = {
  async list(query: GatewayQuery = {}): Promise<GatewayPage<SettingsViewModel>> {
    const limit = Math.min(Math.max(query.limit ?? SETTINGS_CATEGORIES.length, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const records = await Promise.all(SETTINGS_CATEGORIES.map((category) => readCategory(category)));
    const items = records.filter((record): record is SettingsViewModel => record !== null);
    const paged = items.slice(offset, offset + limit);
    return { items: paged, limit, offset, hasMore: items.length > offset + paged.length };
  },

  async getById(id: string): Promise<SettingsViewModel | null> {
    const category = SETTINGS_CATEGORIES.find((value) => value === id);
    return category ? readCategory(category) : null;
  },
};
