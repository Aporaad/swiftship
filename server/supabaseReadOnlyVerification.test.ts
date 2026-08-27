import { describe, expect, it } from 'vitest';

const baseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const canVerify = Boolean(baseUrl && anonKey);

const get = async (path: string) => {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey || '',
      Authorization: `Bearer ${anonKey || ''}`,
      Accept: 'application/json',
      Prefer: 'count=exact',
    },
  });
  expect(response.ok).toBe(true);
  return response;
};

describe.runIf(canVerify)('Supabase read-only verification', () => {
  it('has 18 editable item-category seeds and category fields on product and shipment resources', async () => {
    const categories = await get('items_category?select=id,code,name_ar,is_active&limit=100');
    const categoryRows = await categories.json();
    expect(categoryRows).toHaveLength(18);
    expect(categories.headers.get('content-range')).toMatch(/\/18$/);

    await expect(get('products?select=id,item_category_id,item_category_name,item_category:items_category%21products_item_category_id_fkey(id,code)&limit=1')).resolves.toBeDefined();
    await expect(get('shipments?select=id,content_category_id,content_category_name,carton_count,customs_fee,tax_fee,other_category_fee,category_fees_total,category_fee_currency,content_category:items_category%21shipments_content_category_id_fkey(id,code)&limit=1')).resolves.toBeDefined();
  });

  it('has no source, shipping company, or asset without a linked account', async () => {
    const [sources, carriers, assets] = await Promise.all([
      get('sources?select=id&account_id=is.null&limit=1'),
      get('shipping_companies?select=id&account_id=is.null&limit=1'),
      get('assets?select=id&account_id=is.null&limit=1'),
    ]);
    await expect(sources.json()).resolves.toEqual([]);
    await expect(carriers.json()).resolves.toEqual([]);
    await expect(assets.json()).resolves.toEqual([]);
  });

  it('exposes linked source and shipping-company ledgers in their assigned sections', async () => {
    const [sources, carriers] = await Promise.all([
      get('accounts?select=id,account_code,data&data-%3E%3EentityType=eq.source&limit=1'),
      get('accounts?select=id,account_code,data&data-%3E%3EentityType=eq.shipping_company&limit=1'),
    ]);
    const sourceRows = await sources.json();
    const carrierRows = await carriers.json();
    expect(sourceRows[0]?.account_code).toMatch(/^2141-\d{4}$/);
    expect(carrierRows[0]?.account_code).toMatch(/^2151-\d{4}$/);
  });
});
