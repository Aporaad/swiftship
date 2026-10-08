import { describe, expect, it } from 'vitest';
import { API_MODES, assertProductionApiMode, getApiMode, parseApiMode } from './api-mode';
import { API_CONTRACT_MATRIX, getApiDomainContract } from './api-contract-matrix';

describe('API mode contract', () => {
  it('supports only the explicitly defined migration modes', () => {
    expect(API_MODES).toEqual(['api-only', 'shadow', 'legacy-migration']);
    expect(parseApiMode(' API-ONLY ')).toBe('api-only');
    expect(() => parseApiMode('fallback')).toThrow('Unsupported VITE_API_MODE');
  });

  it('does not allow legacy-migration in production', () => {
    expect(() => assertProductionApiMode('production', getApiMode('legacy-migration'))).toThrow(
      'Production cannot run with VITE_API_MODE=legacy-migration',
    );
    expect(() => assertProductionApiMode('production', getApiMode('shadow'))).not.toThrow();
    expect(() => assertProductionApiMode('production', getApiMode('api-only'))).not.toThrow();
  });

  it('does not silently permit legacy writes in shadow mode', () => {
    expect(getApiMode('shadow')).toMatchObject({
      mode: 'shadow',
      isApiOnly: false,
      allowsLegacyReads: true,
      allowsLegacyWrites: false,
    });
  });
});

describe('API contract matrix', () => {
  it('covers every registered gateway domain and records current gaps', () => {
    const registeredDomains = [
      'accounting', 'auth', 'browser', 'couriers', 'customers', 'employees',
      'financeEntries', 'notifications', 'orders', 'products', 'reports',
      'roles', 'settings', 'shipments', 'siteManagement', 'sources', 'users',
    ];
    expect(API_CONTRACT_MATRIX.length).toBeGreaterThan(0);
    expect(getApiDomainContract('settings')?.status).toBe('missing');
    expect(getApiDomainContract('currencies')?.status).toBe('missing');
    for (const domain of registeredDomains) {
      const contract = getApiDomainContract(domain) ??
        getApiDomainContract(domain === 'financeEntries' ? 'finance' : domain);
      expect(contract, `Missing contract matrix entry for ${domain}`).toBeDefined();
    }
  });
});
