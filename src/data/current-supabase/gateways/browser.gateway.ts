import type { BrowserGateway } from '../../contracts/browser.gateway';
import type { BrowserViewModel } from '../../../features/browser/types';
import { supabase } from '../supabase.client';
import { mapRow, mapSupabaseError } from '../supabase.mapper';

function mapBrowserPage(row: Record<string, unknown>): BrowserViewModel {
  const data = row.data as { url?: unknown } | null;
  return { url: String(data?.url ?? '') };
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
    const { data, error } = await supabase.from('browser_pages').select('browser_page_id,data').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? mapRow(data, mapBrowserPage) : null;
  }
}
