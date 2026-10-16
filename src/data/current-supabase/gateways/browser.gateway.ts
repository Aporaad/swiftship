import type { BrowserGateway } from '../../contracts/browser.gateway';
import type { BrowserViewModel } from '../../../features/browser/types';
import type { BrowserPageCategory, BrowserViewMode } from '../../../data/dtos/browser.dto';
import { supabase } from '../supabase.client';
import { mapRow, mapSupabaseError } from '../supabase.mapper';
import { isoOrNull } from '../../dtos/common.dto';

/**
 * browser_pages صارت أعمدة حقيقية مسطّحة، فلا توجد حمولة jsonb تُقرأ أو تُكتب.
 * browser_pages now stores flat columns, so no jsonb payload is ever read or written here.
 * بيانات الدخول (username/password) تبقى للتخزين فقط ولا تُمرَّر إلى مخرجات الواجهة.
 * Stored credentials stay storage-only and are never mapped to view output.
 */
const BROWSER_PAGE_COLUMNS = [
  'browser_page_id',
  'url',
  'name_ar',
  'name_en',
  'category',
  'tab_color',
  'view_mode',
  'is_pinned',
  'auto_login',
  'username',
  'password',
  'sort_order',
  'created_at',
  'updated_at',
].join(',');

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isoOf(value: unknown) {
  return isoOrNull(typeof value === 'string' ? value : null);
}

function viewModeOf(value: unknown): BrowserViewMode | null {
  return value === 'iframe' || value === 'proxy' ? value : null;
}

function categoryOf(value: unknown): BrowserPageCategory | null {
  return value === 'custom' || value === 'source' || value === 'shipping' ? value : null;
}

function sortOrderOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapBrowserPage(row: Record<string, unknown>): BrowserViewModel {
  return {
    browserPageId: String(row.browser_page_id ?? ''),
    name: nullableText(row.name_ar) ?? nullableText(row.name_en) ?? undefined,
    url: String(row.url ?? ''),
    tabColor: nullableText(row.tab_color),
    isPinned: Boolean(row.is_pinned),
    sortOrder: sortOrderOf(row.sort_order),
    viewMode: viewModeOf(row.view_mode),
    autoLogin: Boolean(row.auto_login),
    category: categoryOf(row.category),
    hasSavedCredentials: Boolean(row.username || row.password),
    createdAt: isoOf(row.created_at) ?? undefined,
    updatedAt: isoOf(row.updated_at),
  };
}

export class CurrentSupabaseBrowserGateway implements BrowserGateway {
  async open(url: string): Promise<BrowserViewModel> {
    if (!url.trim()) throw new Error('Browser URL is required');
    return { url: url.trim() };
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }

  async getCurrent(): Promise<BrowserViewModel | null> {
    const { data, error } = await supabase.from('browser_pages').select(BROWSER_PAGE_COLUMNS).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? mapRow(data, mapBrowserPage) : null;
  }
}
