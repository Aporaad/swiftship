import { describe, expect, it } from 'vitest';

const baseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const canVerify = Boolean(baseUrl && anonKey && !baseUrl.includes('placeholder-project'));

const get = async (path: string) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        headers: {
          apikey: anonKey || '',
          Authorization: `Bearer ${anonKey || ''}`,
          Accept: 'application/json',
          Prefer: 'count=exact',
        },
        signal: AbortSignal.timeout(25000),
      });
      expect(response.ok).toBe(true);
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
};

describe.runIf(canVerify)('Supabase read-only verification', () => {
  it('has 18 editable item-category seeds and category fields on product and shipment resources', async () => {
    const categories = await get('items_category?select=items_category_id,code,name_ar,is_active&limit=100');
    const categoryRows = await categories.json();
    expect(categoryRows.length).toBeGreaterThan(0);
    expect(categories.headers.get('content-range')).toMatch(/\/\d+$/);

    await expect(get('products?select=product_id,item_category_id&limit=1')).resolves.toBeDefined();
    await expect(get('shipments?select=shipment_id,content_category_id,carton_count,customs_fee,tax_fee&limit=1')).resolves.toBeDefined();
  }, 30000);

  it('has no source, shipping company, or asset without a linked account', async () => {
    const [sources, carriers, assets] = await Promise.all([
      get('sources?select=source_id&account_id=is.null&limit=1'),
      get('shipping_companies?select=shipping_company_id&account_id=is.null&limit=1'),
      get('assets?select=asset_id&account_id=is.null&limit=1'),
    ]);
    await expect(sources.json()).resolves.toEqual([]);
    await expect(carriers.json()).resolves.toEqual([]);
    await expect(assets.json()).resolves.toEqual([]);
  }, 30000);

  it('exposes linked source and shipping-company ledgers in their assigned sections', async () => {
    const [sources, carriers] = await Promise.all([
      get('accounts?select=account_id,account_code&entity_type=eq.source&limit=1'),
      get('accounts?select=account_id,account_code&entity_type=eq.shipping_company&limit=1'),
    ]);
    const sourceRows = await sources.json();
    const carrierRows = await carriers.json();
    expect(sourceRows[0]?.account_code).toMatch(/^2141-\d{4}$/);
    expect(carrierRows[0]?.account_code).toMatch(/^2151-\d{4}$/);
  }, 30000);
});
