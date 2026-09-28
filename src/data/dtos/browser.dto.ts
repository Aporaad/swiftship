import type { IsoUtcString } from './common.dto';

export type BrowserViewMode = 'iframe' | 'proxy';
export type BrowserPageCategory = 'custom' | 'source' | 'shipping';

/** JSONB storage shape. Credentials remain storage/input-only and are never mapped to API output. */
export interface BrowserPageData {
  id?: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  tabColor?: string;
  isPinned?: boolean;
  sortOrder?: number;
  viewMode?: BrowserViewMode;
  autoLogin?: boolean;
  category?: BrowserPageCategory;
  sourceId?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface BrowserDatabaseRow {
  browser_page_id: string;
  data: BrowserPageData;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface BrowserApiDto {
  browserPageId: string;
  name: string;
  url: string;
  tabColor: string | null;
  isPinned: boolean;
  sortOrder: number | null;
  viewMode: BrowserViewMode | null;
  autoLogin: boolean;
  category: BrowserPageCategory | null;
  sourceId: string | null;
  hasSavedCredentials: boolean;
  createdAt: IsoUtcString;
  updatedAt: IsoUtcString | null;
}

export interface BrowserCreateInput {
  name: string;
  url: string;
  username?: string;
  password?: string;
  tabColor?: string;
  isPinned?: boolean;
  sortOrder?: number;
  viewMode?: BrowserViewMode;
  autoLogin?: boolean;
  category?: BrowserPageCategory;
  sourceId?: string;
}

export type BrowserUpdateInput = Partial<BrowserCreateInput>;
export type BrowserViewModel = Partial<BrowserApiDto> & Pick<BrowserApiDto, 'url'>;
