import { supabase } from '../../../data/legacy/legacy-compat.ts';

/** Temporary feature gateway backed by the current compatibility adapter. */
export function extractSiteManagementRows(data: any[]): any[] {
  return (data || []).map(row => {
    const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
    return { id: row.id, ...payload };
  });
}

export const siteManagementGateway = {
  selectCollection(collection: string) {
    return supabase.from(collection).select('*');
  },
};
