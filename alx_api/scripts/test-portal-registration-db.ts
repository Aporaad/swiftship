import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import { createApiApp } from '../src/app';
import { parseEnvironment } from '../src/config/env';
import { Ed25519AccessTokenIssuer } from '../src/modules/auth/access-token';
import type { AuthUseCases } from '../src/modules/auth/auth.contracts';
import { createPortalAuthRepository } from '../src/modules/portal/portal-auth.repository';
import { PortalAuthService } from '../src/modules/portal/portal-auth.service';
import { createPortalOwnedRepository } from '../src/modules/portal/portal-owned.repository';
import { PortalOwnedService } from '../src/modules/portal/portal-owned.service';

const connectionString = process.env.TEST_PORTAL_DATABASE_URL;
if (!connectionString) {
  throw new Error('TEST_PORTAL_DATABASE_URL is required for the isolated Portal registration test.');
}

const databaseUrl = new URL(connectionString);
const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
const socketHost = databaseUrl.searchParams.get('host');
const isLocalHost =
  ['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname) || socketHost === '/var/run/postgresql';
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || !isLocalHost || databaseName !== 'alx_api_portal_test') {
  throw new Error('Refusing destructive Portal registration tests unless the host is local and database is exactly alx_api_portal_test.');
}

const pool = new Pool({ connectionString, max: 1, application_name: 'alx-api-portal-registration-test' });
const now = new Date('2026-10-06T20:00:00.000Z');
const hash = '$argon2id$v=19$m=8192,t=1,p=1$c2FsdA$aGFzaA';

async function readMigration(fileName: string): Promise<string> {
  return readFile(resolve('src/db/migrations', fileName), 'utf8');
}

async function resetLocalDatabase(): Promise<void> {
  await pool.query(`
    DO $test_roles$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'alx_api_runtime') THEN
        CREATE ROLE alx_api_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
    END
    $test_roles$;
  `);
  await pool.query('DROP SCHEMA IF EXISTS alx_api_private CASCADE');
  await pool.query(`DROP TABLE IF EXISTS
    public.account_trans, public.main_entry, public.portal_users, public.cust_details, public.customers, public.couriers,
    public.portal_tickets, public.orders_history, public.order_items, public.orders,
    public.sources, public.accounts, public.acc_sub_group, public.currency, public.settings CASCADE`);
  await pool.query(`
    CREATE SCHEMA alx_api_private;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA alx_api_private TO alx_api_runtime;
    CREATE TABLE public.currency (
      cur_id integer PRIMARY KEY, code text NOT NULL, is_default boolean, is_active boolean
    );
    CREATE TABLE public.settings (setting_id text PRIMARY KEY, data jsonb);
    CREATE TABLE public.acc_sub_group (
      acc_sub_group_id text PRIMARY KEY, acc_sub_id text NOT NULL, account_code text NOT NULL,
      entity_type text, is_active boolean NOT NULL, allows_direct_accounts boolean NOT NULL
    );
    CREATE TABLE public.accounts (
      account_id text PRIMARY KEY, account_code text UNIQUE, account_prefix text, account_number text,
      account_seq integer, type text NOT NULL, cur_no integer REFERENCES public.currency(cur_id), currency text,
      limited_balance numeric NOT NULL DEFAULT 0, balance numeric NOT NULL DEFAULT 0,
      debit_total numeric NOT NULL DEFAULT 0, credit_total numeric NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true, acc_sub_id text, group_id text, parent_code text,
      entity_type text, entity_id text, entity_name text, acc_name_ar text, acc_name_en text,
      notes text, created_at timestamptz, updated_at timestamptz
    );
    CREATE TABLE public.customers (
      customer_id text PRIMARY KEY, account_id text REFERENCES public.accounts(account_id),
      is_active boolean NOT NULL, join_by text, referrer_id text, full_name text, address text,
      onboarding_completed boolean, created_at timestamptz, updated_at timestamptz
    );
    CREATE TABLE public.couriers (
      courier_id text PRIMARY KEY, account_id text REFERENCES public.accounts(account_id),
      currency text, is_active boolean NOT NULL, full_name text, courier_type text,
      commission_rate numeric, created_at timestamptz, updated_at timestamptz
    );
    CREATE TABLE public.sources (
      source_id text PRIMARY KEY, account_id text REFERENCES public.accounts(account_id),
      name text, type text, source_url text, name_ar text, name_en text,
      is_active boolean, created_at timestamptz, updated_at timestamptz
    );
    CREATE TABLE public.portal_users (
      portal_user_id text PRIMARY KEY, type text, phone text, portal_role text NOT NULL,
      username text, email text, disabled boolean NOT NULL DEFAULT false, is_disabled boolean,
      approval_status text NOT NULL, full_name text, onboarding_completed boolean,
      join_by text, referrer_id text, linked_customer_id text REFERENCES public.customers(customer_id),
      data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz, updated_at timestamptz
    );
    CREATE TABLE public.cust_details (
      cust_detail_id text PRIMARY KEY, user_uid text NOT NULL, customer_id text,
      join_by text, referrer_id text, onboarding_completed boolean,
      data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz, updated_at timestamptz,
      age integer, body_details text, city text, company_name text, country text, gender text,
      gps_location text, id_number text, max_debt numeric, notes text,
      privacy_policy_agreed boolean, privacy_policy_agreed_at timestamptz
    );
    CREATE TABLE public.orders (
      order_id text PRIMARY KEY, order_number text NOT NULL, customer_id text,
      tracking_number text, order_status_id text, order_status1 text NOT NULL DEFAULT 'تم تسجيل الطلب',
      order_source_id text, order_source_type text, order_party_id text,
      order_party_type text NOT NULL DEFAULT 'customer', is_staff_order boolean NOT NULL DEFAULT false,
      employee_id text, courier_id text, delivery_courier_id text, shipping_courier_id text,
      order_party_account_id text, currency integer, order_currency integer,
      order_currency_price integer, external_order_number text, data jsonb,
      created_by text, created_by_name text, updated_by text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
    );
    CREATE TABLE public.order_items (
      order_item_id text PRIMARY KEY, order_id text, product_id text, product_name text,
      product_price numeric DEFAULT 0, product_url text, nota text, quantity numeric DEFAULT 1,
      total_price numeric DEFAULT 0, total__weight numeric DEFAULT 0, total_cbm numeric DEFAULT 0,
      items_status text DEFAULT 'قيد الطلب', created_by text, updated_by text,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.orders_history (
      orders_history_id text PRIMARY KEY, order_id text NOT NULL, order_number text NOT NULL,
      shipment_id text, event_type text NOT NULL, event_category text NOT NULL,
      operation text NOT NULL, entity_type text NOT NULL, actor_id text NOT NULL,
      source text NOT NULL, summary text NOT NULL, before_data jsonb, after_data jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL,
      created_by text NOT NULL, updated_by text NOT NULL
    );
    CREATE TABLE public.portal_tickets (
      portal_ticket_id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(), type text,
      status text NOT NULL DEFAULT 'open', user_uid text, updated_at timestamptz,
      created_by text, updated_by text, message text, replies jsonb, subject text
    );
    CREATE TABLE public.main_entry (
      main_entry_id text PRIMARY KEY, posting_status text NOT NULL
    );
    CREATE TABLE public.account_trans (
      account_trans_id text PRIMARY KEY, main_entry_id text NOT NULL REFERENCES public.main_entry(main_entry_id),
      account_id text NOT NULL, trans_type text NOT NULL,
      amount_original numeric NOT NULL, currency_original_no integer NOT NULL
    );
    INSERT INTO public.currency (cur_id, code, is_default, is_active) VALUES (1, 'YER', true, true);
    INSERT INTO public.settings (setting_id, data) VALUES (
      'general', '{"exchangeRateSAR":139,"defaultDeliveryFee":4000,"defaultCompanyProfitRate":12,"defaultPackagingFee":3}'::jsonb
    );
    INSERT INTO public.acc_sub_group (acc_sub_group_id, acc_sub_id, account_code, entity_type, is_active, allows_direct_accounts)
      VALUES ('1132', '113', '1132', 'customer', true, true),
             ('2121', '212', '2121', 'courier', true, true),
             ('2141', '214', '2141', 'source', true, true);
  `);
  await pool.query(await readMigration('0013_portal_auth_private_storage.sql'));
  await pool.query(await readMigration('0014_portal_registration_details.sql'));
  await pool.query(await readMigration('0009_operations_idempotency.sql'));
  await pool.query(await readMigration('0015_portal_owned_resource_indexes.sql'));
  await pool.query(await readMigration('0016_cust_details_rls.sql'));
  await pool.query(await readMigration('0017_portal_payment_requests.sql'));
  await pool.query(`
    GRANT SELECT ON public.acc_sub_group, public.currency, public.settings TO alx_api_runtime;
    GRANT SELECT ON public.main_entry, public.account_trans TO alx_api_runtime;
    GRANT SELECT, INSERT ON public.accounts, public.customers, public.couriers, public.sources,
      public.portal_users TO alx_api_runtime;
    GRANT UPDATE ON public.portal_users, public.customers, public.couriers, public.sources TO alx_api_runtime;
    GRANT SELECT, INSERT, UPDATE ON public.orders, public.order_items, public.orders_history,
      public.portal_tickets TO alx_api_runtime;
  `);
  const paymentRequestSecurity = await pool.query(
    `SELECT c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
            has_table_privilege('alx_api_runtime', 'alx_api_private.portal_payment_requests', 'SELECT') AS runtime_can_read,
            has_table_privilege('anon', 'alx_api_private.portal_payment_requests', 'SELECT') AS anon_can_read,
            has_table_privilege('authenticated', 'alx_api_private.portal_payment_requests', 'SELECT') AS authenticated_can_read,
            has_table_privilege('service_role', 'alx_api_private.portal_payment_requests', 'SELECT') AS service_role_can_read
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'alx_api_private' AND c.relname = 'portal_payment_requests'
      LIMIT 1`,
  );
  assert.deepEqual(paymentRequestSecurity.rows[0], {
    rls_enabled: true,
    force_rls: true,
    runtime_can_read: true,
    anon_can_read: false,
    authenticated_can_read: false,
    service_role_can_read: false,
  });
  const legacyOwnerUid = '00000000-0000-0000-0000-000000000001';
  await pool.query('GRANT USAGE ON SCHEMA auth TO authenticated');
  await pool.query('GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated');
  await pool.query(
    `INSERT INTO public.cust_details (cust_detail_id, user_uid, data, created_at, updated_at)
     VALUES ('legacy-owner-fixture', $1, '{}'::jsonb, now(), now())`,
    [legacyOwnerUid],
  );
  await pool.query('SET ROLE authenticated');
  await pool.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [legacyOwnerUid]);
  const ownerRows = await pool.query('SELECT cust_detail_id FROM public.cust_details LIMIT 10');
  assert.deepEqual(ownerRows.rows.map((row) => row.cust_detail_id), ['legacy-owner-fixture']);
  await pool.query('RESET ROLE');
  await pool.query("DELETE FROM public.cust_details WHERE cust_detail_id = 'legacy-owner-fixture'");
  await pool.query('SET ROLE alx_api_runtime');
}

async function run(): Promise<void> {
  try {
    const current = await pool.query('SELECT current_database() AS database_name LIMIT 1');
    assert.equal(current.rows[0]?.database_name, 'alx_api_portal_test');
    await resetLocalDatabase();

    const repository = createPortalAuthRepository(pool);
    const registrations = [
      {
        portalUserId: 'portal-customer-test', username: 'customer-test', email: 'customer@test.example',
        fullName: 'Synthetic Customer', phone: '700000001', role: 'customer' as const,
        approvalStatus: 'approved' as const, onboardingCompleted: false, passwordHash: hash, createdAt: now,
        address: 'Synthetic Customer Address', joinBy: 'web', referrerId: 'synthetic-referrer',
      },
      {
        portalUserId: 'portal-courier-test', username: 'courier-test', email: 'courier@test.example',
        fullName: 'Synthetic Courier', phone: '700000002', role: 'courier' as const,
        approvalStatus: 'pending_approval' as const, onboardingCompleted: true, passwordHash: hash, createdAt: now,
        address: 'Synthetic Courier Address', courierType: 'local' as const, identityDocNote: 'synthetic-id-note',
      },
      {
        portalUserId: 'portal-supplier-test', username: 'supplier-test', email: 'supplier@test.example',
        fullName: 'Synthetic Supplier Contact', phone: '700000003', role: 'supplier' as const,
        approvalStatus: 'pending_approval' as const, onboardingCompleted: true, passwordHash: hash, createdAt: now,
        address: 'Synthetic Supplier Address', companyName: 'Synthetic Supplier Co.',
        commercialRegister: 'synthetic-reg-number',
      },
    ];

    const profiles = [];
    for (const registration of registrations) profiles.push(await repository.createPortalUser(registration));

    assert.deepEqual(profiles.map(({ role }) => role), ['customer', 'courier', 'supplier']);
    assert.deepEqual(profiles.map(({ financialAccountCode }) => financialAccountCode), ['1132-0001', '2121-0001', '2141-0001']);
    assert.deepEqual(profiles.map(({ financialCurrency }) => financialCurrency), ['YER', 'YER', 'YER']);
    assert.equal(profiles[0]?.linkedCustomerId, 'cust_0001');
    assert.equal(profiles[1]?.linkedCourierId, 'cour_0001');
    assert.equal(profiles[2]?.linkedSourceId, 'src_0001');
    assert.equal(profiles[0]?.address, 'Synthetic Customer Address');
    assert.equal(profiles[1]?.address, 'Synthetic Courier Address');
    assert.equal(profiles[2]?.address, 'Synthetic Supplier Address');

    const updatedCustomer = await repository.updatePortalProfile({
      portalUserId: 'portal-customer-test',
      fullName: 'Updated Synthetic Customer',
      address: 'Updated Customer Address',
      updatedAt: new Date(now.getTime() + 1_000),
    });
    assert.equal(updatedCustomer.fullName, 'Updated Synthetic Customer');
    assert.equal(updatedCustomer.address, 'Updated Customer Address');
    const customerEntity = await pool.query(
      'SELECT full_name, address FROM public.customers WHERE customer_id = $1 LIMIT 1',
      ['cust_0001'],
    );
    assert.deepEqual(customerEntity.rows[0], {
      full_name: 'Updated Synthetic Customer', address: 'Updated Customer Address',
    });

    const clearedCustomer = await repository.updatePortalProfile({
      portalUserId: 'portal-customer-test',
      address: '',
      updatedAt: new Date(now.getTime() + 2_000),
    });
    assert.equal(clearedCustomer.address, '');
    const clearedEntity = await pool.query(
      'SELECT address FROM public.customers WHERE customer_id = $1 LIMIT 1',
      ['cust_0001'],
    );
    assert.equal(clearedEntity.rows[0]?.address, null);

    await repository.updatePortalProfile({
      portalUserId: 'portal-supplier-test',
      fullName: 'Updated Synthetic Supplier Contact',
      updatedAt: new Date(now.getTime() + 3_000),
    });
    const supplierEntity = await pool.query(
      'SELECT name FROM public.sources WHERE source_id = $1 LIMIT 1',
      ['src_0001'],
    );
    assert.equal(supplierEntity.rows[0]?.name, 'Updated Synthetic Supplier Contact');

    const relations = await pool.query(`
      SELECT
        (SELECT count(*)::integer FROM public.accounts) AS accounts,
        (SELECT count(*)::integer FROM public.customers) AS customers,
        (SELECT count(*)::integer FROM public.couriers) AS couriers,
        (SELECT count(*)::integer FROM public.sources) AS sources,
        (SELECT count(*)::integer FROM public.cust_details) AS customer_details,
        (SELECT count(*)::integer FROM alx_api_private.portal_credentials) AS credentials,
        (SELECT count(*)::integer FROM alx_api_private.portal_registration_details) AS private_details
      LIMIT 1
    `);
    assert.deepEqual(relations.rows[0], {
      accounts: 3, customers: 1, couriers: 1, sources: 1,
      customer_details: 1, credentials: 3, private_details: 3,
    });

    const accountLinks = await pool.query(`
      SELECT a.account_code, a.entity_type, a.entity_id, a.currency,
             c.account_id AS customer_account_id, r.account_id AS courier_account_id,
             s.account_id AS source_account_id
        FROM public.accounts a
        LEFT JOIN public.customers c ON c.customer_id = a.entity_id
        LEFT JOIN public.couriers r ON r.courier_id = a.entity_id
        LEFT JOIN public.sources s ON s.source_id = a.entity_id
       ORDER BY a.account_code
       LIMIT 10
    `);
    assert.deepEqual(accountLinks.rows.map((row) => row.account_code), ['1132-0001', '2121-0001', '2141-0001']);
    assert.equal(accountLinks.rows[0]?.customer_account_id, '1132-0001');
    assert.equal(accountLinks.rows[1]?.courier_account_id, '2121-0001');
    assert.equal(accountLinks.rows[2]?.source_account_id, '2141-0001');

    const privateData = await pool.query(
      'SELECT address, company_name, commercial_register, courier_type, identity_doc_note FROM alx_api_private.portal_registration_details WHERE portal_user_id = $1 LIMIT 1',
      ['portal-supplier-test'],
    );
    assert.equal(privateData.rows[0]?.commercial_register, 'synthetic-reg-number');
    const publicIdentity = await pool.query(
      'SELECT data FROM public.portal_users WHERE portal_user_id = $1 LIMIT 1',
      ['portal-supplier-test'],
    );
    assert.equal(publicIdentity.rows[0]?.data?.commercialRegister, undefined);
    assert.equal(publicIdentity.rows[0]?.data?.address, undefined);

    await assert.rejects(
      repository.createPortalUser({ ...registrations[0]!, portalUserId: 'portal-duplicate-test' }),
      /PORTAL_ACCOUNT_EXISTS/,
    );
    const countsAfterDuplicate = await pool.query('SELECT count(*)::integer AS count FROM public.portal_users LIMIT 1');
    assert.equal(countsAfterDuplicate.rows[0]?.count, 3, 'duplicate registration must roll back without partial rows');

    const security = await pool.query(`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
             has_table_privilege('alx_api_runtime', 'alx_api_private.portal_registration_details', 'SELECT') AS runtime_can_select,
             has_table_privilege('anon', 'alx_api_private.portal_registration_details', 'SELECT') AS anon_can_select,
             has_table_privilege('alx_api_runtime', 'public.cust_details', 'UPDATE') AS details_runtime_can_update,
             has_table_privilege('anon', 'public.cust_details', 'SELECT') AS details_anon_can_select
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'cust_details'
       LIMIT 1
    `);
    assert.deepEqual(security.rows[0], {
      enabled: true, forced: true,
      runtime_can_select: true, anon_can_select: false,
      details_runtime_can_update: true, details_anon_can_select: false,
    });

    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const issuer = new Ed25519AccessTokenIssuer(privateKeyPem, 'portal-local-test', 'portal-local-client');
    const service = new PortalAuthService(repository, issuer, {
      accessTokenTtlSeconds: 600,
      refreshTokenTtlSeconds: 86_400,
      accessTokenPublicKeyPem: publicKeyPem,
      jwtIssuer: 'portal-local-test',
      jwtAudience: 'portal-local-client',
      argon2MemoryKiB: 8_192,
      argon2TimeCost: 1,
      argon2Parallelism: 1,
    });
    const portalOwned = new PortalOwnedService(service, createPortalOwnedRepository(pool));
    const systemAuth = {
      async authenticateAccessToken({ accessToken }: { accessToken: string }) {
        if (!accessToken.startsWith('staff-test-')) throw new Error('INVALID_TOKEN');
        return { userId: accessToken === 'staff-test-view-only' ? 'finance-viewer' : 'finance-reviewer', sessionId: 'staff-test-session', role: 'staff' };
      },
      async listPermissions({ userId }: { userId: string }) {
        return userId === 'finance-viewer' ? ['view_finance'] : ['view_finance', 'post_financial_entries'];
      },
    } as unknown as AuthUseCases;
    const app = createApiApp({
      environment: parseEnvironment({
        NODE_ENV: 'test', HOST: '127.0.0.1', PORT: '3001',
        CORS_ORIGINS: 'https://portal.example.test', RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX: '100',
      }),
      auth: systemAuth,
      portalAuth: service,
      portalOwned,
    });

    const registrationResponse = await request(app).post('/api/v1/portal/auth/register').send({
      fullName: 'HTTP Synthetic Customer',
      phone: '700000004',
      email: 'http-customer@test.example',
      password: 'Strong-Local-Pass-123',
      portalRole: 'customer',
      address: 'HTTP Synthetic Address',
    });
    assert.equal(registrationResponse.status, 200, JSON.stringify(registrationResponse.body));
    assert.equal(registrationResponse.body.data.profile.financialAccountCode, '1132-0002');
    assert.equal(registrationResponse.body.data.profile.linkedCustomerId, 'cust_0002');
    assert.ok(registrationResponse.body.data.tokens?.accessToken);
    const portalUserId = String(registrationResponse.body.data.profile.portalUserId);

    const courierRegistration = await request(app).post('/api/v1/portal/auth/register').send({
      fullName: 'HTTP Synthetic Courier', phone: '700000007', email: 'http-courier@test.example',
      password: 'Strong-Local-Pass-123', portalRole: 'courier', courierType: 'local',
      address: 'HTTP Courier Address', identityDocNote: 'HTTP synthetic verification note',
    });
    assert.equal(courierRegistration.status, 200, JSON.stringify(courierRegistration.body));
    assert.equal(courierRegistration.body.data.profile.financialAccountCode, '2121-0002');
    assert.equal(courierRegistration.body.data.profile.linkedCourierId, 'cour_0002');

    const supplierRegistration = await request(app).post('/api/v1/portal/auth/register').send({
      fullName: 'HTTP Synthetic Supplier', phone: '700000008', email: 'http-supplier@test.example',
      password: 'Strong-Local-Pass-123', portalRole: 'supplier', companyName: 'HTTP Supplier Co.',
      commercialRegister: 'HTTP-synthetic-register', address: 'HTTP Supplier Address',
    });
    assert.equal(supplierRegistration.status, 200, JSON.stringify(supplierRegistration.body));
    assert.equal(supplierRegistration.body.data.profile.financialAccountCode, '2141-0002');
    assert.equal(supplierRegistration.body.data.profile.linkedSourceId, 'src_0002');

    const loginResponse = await request(app).post('/api/v1/portal/auth/login').send({
      identifier: 'http-customer@test.example',
      password: 'Strong-Local-Pass-123',
    });
    assert.equal(loginResponse.status, 200, JSON.stringify(loginResponse.body));
    const accessToken = String(loginResponse.body.data.accessToken);
    const profileResponse = await request(app)
      .get('/api/v1/portal/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(profileResponse.status, 200, JSON.stringify(profileResponse.body));
    assert.equal(profileResponse.body.data.address, 'HTTP Synthetic Address');
    assert.equal(profileResponse.body.data.financialAccountCode, '1132-0002');

    const profileUpdateResponse = await request(app)
      .patch('/api/v1/portal/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'HTTP Updated Customer', address: 'HTTP Updated Address' });
    assert.equal(profileUpdateResponse.status, 200, JSON.stringify(profileUpdateResponse.body));
    assert.equal(profileUpdateResponse.body.data.fullName, 'HTTP Updated Customer');
    assert.equal(profileUpdateResponse.body.data.address, 'HTTP Updated Address');

    const initialCustomerDetails = await request(app)
      .get('/api/v1/portal/customer-details')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(initialCustomerDetails.status, 200, JSON.stringify(initialCustomerDetails.body));
    assert.equal(initialCustomerDetails.body.data.userUid, portalUserId);
    assert.equal(initialCustomerDetails.body.data.customerId, 'cust_0002');
    assert.equal(initialCustomerDetails.body.data.privacyPolicyAgreed, false);

    const incompleteOnboarding = await request(app)
      .put('/api/v1/portal/customer-details')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ onboardingCompleted: true });
    assert.equal(incompleteOnboarding.status, 400, JSON.stringify(incompleteOnboarding.body));

    const customerDetailsResponse = await request(app)
      .put('/api/v1/portal/customer-details')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        privacyPolicyAgreed: true,
        gender: 'female',
        age: 31,
        location: {
          country: 'Yemen', governorate: 'Aden', city: 'Aden', street: 'Test Street',
          lat: 12.8, lng: 45.0,
        },
        bodyDetails: { heightCm: 165, preferredColors: ['blue'] },
        preferredCategories: ['clothing'],
        acquisitionSource: { joinBy: 'friend', referrerId: 'test-referrer' },
        onboardingCompleted: true,
      });
    assert.equal(customerDetailsResponse.status, 200, JSON.stringify(customerDetailsResponse.body));
    assert.equal(customerDetailsResponse.body.data.userUid, portalUserId);
    assert.equal(customerDetailsResponse.body.data.customerId, 'cust_0002');
    assert.equal(customerDetailsResponse.body.data.privacyPolicyAgreed, true);
    assert.equal(customerDetailsResponse.body.data.onboardingCompleted, true);
    assert.equal(customerDetailsResponse.body.data.gender, 'female');
    assert.equal(customerDetailsResponse.body.data.location.city, 'Aden');
    assert.ok(customerDetailsResponse.body.data.privacyPolicyAgreedAt > 0);
    const structuredDetails = await pool.query(
      `SELECT privacy_policy_agreed, age, gender, country, city, body_details
         FROM public.cust_details
        WHERE user_uid = $1
        LIMIT 1`,
      [portalUserId],
    );
    assert.deepEqual(structuredDetails.rows[0], {
      privacy_policy_agreed: true,
      age: 31,
      gender: 'female',
      country: 'Yemen',
      city: 'Aden',
      body_details: JSON.stringify({ heightCm: 165, preferredColors: ['blue'] }),
    });

    const forgedDetails = await request(app)
      .put('/api/v1/portal/customer-details')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userUid: 'another-user', onboardingCompleted: false });
    assert.equal(forgedDetails.status, 400, 'user/customer ownership IDs are not accepted from the client');

    const detailsLinks = await pool.query(
      `SELECT p.onboarding_completed AS portal_completed, c.onboarding_completed AS customer_completed,
              p.join_by AS portal_join_by, c.join_by AS customer_join_by
         FROM public.portal_users p
         JOIN public.customers c ON c.customer_id = p.linked_customer_id
        WHERE p.portal_user_id = $1
        LIMIT 1`,
      [portalUserId],
    );
    assert.deepEqual(detailsLinks.rows[0], {
      portal_completed: true,
      customer_completed: true,
      portal_join_by: 'friend',
      customer_join_by: 'friend',
    });

    const ticketResponse = await request(app)
      .post('/api/v1/portal/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'inquiry', subject: 'Synthetic ticket', message: 'Synthetic support message.' });
    assert.equal(ticketResponse.status, 201, JSON.stringify(ticketResponse.body));
    assert.equal(ticketResponse.body.data.userUid, portalUserId);
    const ticketListResponse = await request(app)
      .get('/api/v1/portal/tickets')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(ticketListResponse.status, 200, JSON.stringify(ticketListResponse.body));
    assert.equal(ticketListResponse.body.data.length, 1);

    const orderPayload = {
      items: [{ productName: 'Synthetic item', quantity: 2, productPrice: 15, weight: 1, cbm: 0.01 }],
      packagingType: 'normal', isUrgent: false, packageType: 'standard',
      paymentMethod: 'Cash', notes: 'Synthetic note',
    };
    const forgedTotalsResponse = await request(app)
      .post('/api/v1/portal/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', 'portal-order-forged-test-01')
      .send({ ...orderPayload, totalCostYER: 1 });
    assert.equal(forgedTotalsResponse.status, 400, 'the API must reject client-calculated totals');

    const createOrder = () => request(app)
      .post('/api/v1/portal/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', 'portal-order-http-test-001')
      .send(orderPayload);
    const orderResponse = await createOrder();
    assert.equal(orderResponse.status, 201, JSON.stringify(orderResponse.body));
    assert.equal(orderResponse.body.data.customerId, undefined, 'ownership IDs must not be returned to the portal');
    assert.equal(orderResponse.body.data.amountPaid, undefined, 'the portal cannot assert a payment amount');
    assert.equal(orderResponse.body.data.paymentStatus, 'Unpaid');
    assert.equal(orderResponse.body.data.productsSum, 30);
    assert.equal(orderResponse.body.data.packagingFee, 3);
    assert.equal(orderResponse.body.data.exchangeRateYER, 139);
    assert.equal(orderResponse.body.data.totalCostSAR, 72.6);
    assert.equal(orderResponse.body.data.totalCostYER, 14_091.4);
    const replayedOrderResponse = await createOrder();
    assert.equal(replayedOrderResponse.status, 201, JSON.stringify(replayedOrderResponse.body));
    assert.equal(replayedOrderResponse.body.data.id, orderResponse.body.data.id);
    const customerOrdersResponse = await request(app)
      .get('/api/v1/portal/orders')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(customerOrdersResponse.status, 200, JSON.stringify(customerOrdersResponse.body));
    assert.equal(customerOrdersResponse.body.data.length, 1);
    assert.equal(customerOrdersResponse.body.data[0]?.customerNote, 'Synthetic note');

    const paymentRequestPayload = {
      amount: 250,
      currency: 'YER',
      paymentMethod: 'transfer',
      reference: 'SYNTHETIC-TRANSFER-01',
      notes: 'Synthetic proof pending review',
    };
    const createPaymentRequest = () => request(app)
      .post('/api/v1/portal/payment-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', 'portal-payment-http-test-001')
      .send(paymentRequestPayload);
    const paymentRequestResponse = await createPaymentRequest();
    assert.equal(paymentRequestResponse.status, 201, JSON.stringify(paymentRequestResponse.body));
    assert.equal(paymentRequestResponse.body.data.status, 'pending_verification');
    assert.equal(paymentRequestResponse.body.data.financeEntryId, undefined);
    const paymentRequestId = String(paymentRequestResponse.body.data.id);
    const replayedPaymentRequest = await createPaymentRequest();
    assert.equal(replayedPaymentRequest.status, 201, JSON.stringify(replayedPaymentRequest.body));
    assert.equal(replayedPaymentRequest.body.data.id, paymentRequestId, 'payment request idempotency must not duplicate claims');
    const paymentRequestConflict = await request(app)
      .post('/api/v1/portal/payment-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', 'portal-payment-http-test-001')
      .send({ ...paymentRequestPayload, amount: 300 });
    assert.equal(paymentRequestConflict.status, 409, 'idempotency key must reject a different payload');
    const forgedPaymentRequest = await request(app)
      .post('/api/v1/portal/payment-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', 'portal-payment-forged-test-01')
      .send({ ...paymentRequestPayload, financialAccountId: 'another-customer-account' });
    assert.equal(forgedPaymentRequest.status, 400, 'financial ownership identifiers are not accepted from customers');
    const paymentRequestsBeforeSettlement = await request(app)
      .get('/api/v1/portal/payment-requests')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(paymentRequestsBeforeSettlement.status, 200);
    assert.equal(paymentRequestsBeforeSettlement.body.data.length, 1);
    assert.equal(paymentRequestsBeforeSettlement.body.data[0]?.status, 'pending_verification');
    const ledgerRowsBeforeSettlement = await pool.query(
      'SELECT (SELECT count(*)::integer FROM public.main_entry) AS entries, (SELECT count(*)::integer FROM public.account_trans) AS movements LIMIT 1',
    );
    assert.deepEqual(ledgerRowsBeforeSettlement.rows[0], { entries: 0, movements: 0 }, 'submitting a request never posts or changes the ledger');

    const reviewWithoutAuth = await request(app).get('/api/v1/finance/portal-payment-requests');
    assert.equal(reviewWithoutAuth.status, 401);
    const reviewQueue = await request(app)
      .get('/api/v1/finance/portal-payment-requests')
      .set('Authorization', 'Bearer staff-test-reviewer');
    assert.equal(reviewQueue.status, 200, JSON.stringify(reviewQueue.body));
    assert.equal(reviewQueue.body.data.length, 1);
    const financeAccountResult = await pool.query<{ accountId: string }>(
      `SELECT data ->> 'financialAccountId' AS "accountId"
         FROM public.portal_users WHERE portal_user_id = $1 LIMIT 1`,
      [portalUserId],
    );
    const customerFinanceAccountId = String(financeAccountResult.rows[0]?.accountId ?? '');
    assert.ok(customerFinanceAccountId, 'API registration must link the customer financial account');
    const settlementUrl = `/api/v1/finance/portal-payment-requests/${paymentRequestId}/settle`;
    const forbiddenSettlement = await request(app)
      .post(settlementUrl)
      .set('Authorization', 'Bearer staff-test-view-only')
      .send({ financeEntryId: 'test-entry' });
    assert.equal(forbiddenSettlement.status, 403, 'finance posting permission is required for settlement');
    await pool.query('RESET ROLE');
    await pool.query("INSERT INTO public.main_entry (main_entry_id, posting_status) VALUES ('synthetic-payment-draft', 'draft')");
    await pool.query(
      `INSERT INTO public.account_trans (account_trans_id, main_entry_id, account_id, trans_type, amount_original, currency_original_no)
       VALUES ('synthetic-payment-draft-line', 'synthetic-payment-draft', $1, 'Credit', 250, 1)`,
      [customerFinanceAccountId],
    );
    await pool.query('SET ROLE alx_api_runtime');
    const draftSettlement = await request(app)
      .post(settlementUrl)
      .set('Authorization', 'Bearer staff-test-reviewer')
      .send({ financeEntryId: 'synthetic-payment-draft' });
    assert.equal(draftSettlement.status, 409, 'unposted financial entries cannot settle payment claims');
    await pool.query('RESET ROLE');
    await pool.query("UPDATE public.main_entry SET posting_status = 'posted' WHERE main_entry_id = 'synthetic-payment-draft'");
    await pool.query('SET ROLE alx_api_runtime');
    const settledPaymentRequest = await request(app)
      .post(settlementUrl)
      .set('Authorization', 'Bearer staff-test-reviewer')
      .send({ financeEntryId: 'synthetic-payment-draft' });
    assert.equal(settledPaymentRequest.status, 200, JSON.stringify(settledPaymentRequest.body));
    assert.equal(settledPaymentRequest.body.data.status, 'settled');
    assert.equal(settledPaymentRequest.body.data.financeEntryId, 'synthetic-payment-draft');
    const secondClaimForSameEntry = await request(app)
      .post('/api/v1/portal/payment-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', 'portal-payment-reuse-test-001')
      .send({ amount: 250, currency: 'YER', paymentMethod: 'transfer' });
    assert.equal(secondClaimForSameEntry.status, 201);
    const reusedEntryResponse = await request(app)
      .post(`/api/v1/finance/portal-payment-requests/${secondClaimForSameEntry.body.data.id}/settle`)
      .set('Authorization', 'Bearer staff-test-reviewer')
      .send({ financeEntryId: 'synthetic-payment-draft' });
    assert.equal(reusedEntryResponse.status, 409, 'a posted finance entry cannot settle multiple customer claims');
    const rejectSecondClaim = await request(app)
      .post(`/api/v1/finance/portal-payment-requests/${secondClaimForSameEntry.body.data.id}/reject`)
      .set('Authorization', 'Bearer staff-test-reviewer')
      .send({ reviewNote: 'Duplicate posted entry was already linked' });
    assert.equal(rejectSecondClaim.status, 200);

    const secondRegistrationResponse = await request(app).post('/api/v1/portal/auth/register').send({
      fullName: 'Second Synthetic Customer', phone: '700000006', email: 'http-customer-2@test.example',
      password: 'Strong-Local-Pass-123', portalRole: 'customer',
    });
    assert.equal(secondRegistrationResponse.status, 200, JSON.stringify(secondRegistrationResponse.body));
    const secondAccessToken = String(secondRegistrationResponse.body.data.tokens.accessToken);
    const secondPaymentRequestResponse = await request(app)
      .post('/api/v1/portal/payment-requests')
      .set('Authorization', `Bearer ${secondAccessToken}`)
      .set('Idempotency-Key', 'portal-payment-second-user-001')
      .send({ amount: 50, currency: 'USD', paymentMethod: 'wallet' });
    assert.equal(secondPaymentRequestResponse.status, 201, JSON.stringify(secondPaymentRequestResponse.body));
    const secondPaymentRequestId = String(secondPaymentRequestResponse.body.data.id);
    const secondPaymentRequests = await request(app)
      .get('/api/v1/portal/payment-requests')
      .set('Authorization', `Bearer ${secondAccessToken}`);
    assert.equal(secondPaymentRequests.status, 200);
    assert.equal(secondPaymentRequests.body.data.length, 1, 'the second customer only sees their own payment request');
    const firstPaymentRequestsAfterSecondClaim = await request(app)
      .get('/api/v1/portal/payment-requests')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(firstPaymentRequestsAfterSecondClaim.body.data.length, 2);
    assert.equal(
      firstPaymentRequestsAfterSecondClaim.body.data.some((item: { id: string }) => item.id === secondPaymentRequestId),
      false,
      'the first customer cannot see the second claim',
    );
    const rejectedPaymentRequest = await request(app)
      .post(`/api/v1/finance/portal-payment-requests/${secondPaymentRequestId}/reject`)
      .set('Authorization', 'Bearer staff-test-reviewer')
      .send({ reviewNote: 'Synthetic rejection for integration test' });
    assert.equal(rejectedPaymentRequest.status, 200, JSON.stringify(rejectedPaymentRequest.body));
    assert.equal(rejectedPaymentRequest.body.data.status, 'rejected');
    assert.equal(rejectedPaymentRequest.body.data.reviewNote, 'Synthetic rejection for integration test');
    const secondCustomerOrders = await request(app)
      .get('/api/v1/portal/orders')
      .set('Authorization', `Bearer ${secondAccessToken}`);
    assert.equal(secondCustomerOrders.status, 200);
    assert.equal(secondCustomerOrders.body.data.length, 0, 'a different customer cannot read another customer order');
    const secondCustomerTickets = await request(app)
      .get('/api/v1/portal/tickets')
      .set('Authorization', `Bearer ${secondAccessToken}`);
    assert.equal(secondCustomerTickets.status, 200);
    assert.equal(secondCustomerTickets.body.data.length, 0, 'a different portal user cannot read another user ticket');

    const duplicateResponse = await request(app).post('/api/v1/portal/auth/register').send({
      fullName: 'Duplicate Synthetic Customer',
      phone: '700000005',
      email: 'http-customer@test.example',
      password: 'Strong-Local-Pass-123',
      portalRole: 'customer',
    });
    assert.equal(duplicateResponse.status, 409);
    assert.equal(duplicateResponse.body.error.code, 'PORTAL_ACCOUNT_EXISTS');

    console.info('Portal PostgreSQL/HTTP integration passed: customer/courier/supplier provisioning, private profiles, owned tickets/orders/payment requests, server pricing, idempotency, payment-request settlement/rejection permissions, posted-entry matching, no auto-ledger writes, and RLS.');
  } finally {
    await pool.end();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
