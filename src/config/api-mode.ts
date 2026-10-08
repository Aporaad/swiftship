export const API_MODES = ['api-only', 'shadow', 'legacy-migration'] as const;

export type ApiMode = (typeof API_MODES)[number];

export interface ApiModeConfig {
  mode: ApiMode;
  isApiOnly: boolean;
  allowsLegacyReads: boolean;
  allowsLegacyWrites: boolean;
}

const DEFAULT_MODE: ApiMode = 'legacy-migration';

function readRawMode(): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_API_MODE;
  }
  return undefined;
}

export function parseApiMode(rawMode: string | undefined): ApiMode {
  if (!rawMode || rawMode.trim() === '') return DEFAULT_MODE;
  const normalized = rawMode.trim().toLowerCase();
  if ((API_MODES as readonly string[]).includes(normalized)) return normalized as ApiMode;
  throw new Error(`Unsupported VITE_API_MODE: ${rawMode}. Expected one of ${API_MODES.join(', ')}.`);
}

export function getApiMode(rawMode: string | undefined = readRawMode()): ApiModeConfig {
  const mode = parseApiMode(rawMode);
  return {
    mode,
    isApiOnly: mode === 'api-only',
    allowsLegacyReads: mode !== 'api-only',
    allowsLegacyWrites: mode === 'legacy-migration',
  };
}

export function assertProductionApiMode(nodeEnv: string | undefined, config = getApiMode()): void {
  if (nodeEnv === 'production' && config.mode === 'legacy-migration') {
    throw new Error('Production cannot run with VITE_API_MODE=legacy-migration. Use api-only or shadow.');
  }
}
