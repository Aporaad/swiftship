import type { BrowserViewModel } from '../../features/browser/types';

export interface BrowserGateway {
  open(url: string): Promise<BrowserViewModel>;
  close(): Promise<void>;
  getCurrent(): Promise<BrowserViewModel | null>;
}
