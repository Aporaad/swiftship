import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  PortalAuthCredential,
  PortalAuthIdentity,
  PortalAuthRepository,
} from './portal-auth.contracts';
import type { ApprovalStatus, PortalRole } from './portal.contracts';

function role(value: unknown): PortalRole {
  return value === 'courier' || value === 'supplier' ? value : 'customer';
}

function approval(value: unknown): ApprovalStatus {
  return value === 'pending_approval' || value === 'rejected' ? value : 'approved';
}

function identity(row: Record<string, unknown>): PortalAuthIdentity {
  const data = typeof row.data === 'string'
    ? JSON.parse(row.data) as Record<string, unknown>
    : (row.data && typeof row.data === 'object' ? row.data as Record<string, unknown> : {});
  const text = (column: unknown, jsonKey: string): string => String(column ?? data[jsonKey] ?? '');
  return {
    portalUserId: String(row.portalUserId),
    username: text(row.username, 'username'),
    email: text(row.email, 'email'),
    fullName: text(row.fullName, 'fullName'),
    phone: text(row.phone, 'phone'),
    role: role(row.portalRole ?? data.portalRole ?? row.type),
    approvalStatus: approval(row.approvalStatus ?? data.approvalStatus),
    onboardingCompleted: Boolean(row.onboardingCompleted ?? data.onboardingCompleted),
    disabled: Boolean(row.disabled || row.isDisabled || data.disabled === true),
    address: row.address === null ? '' : text(row.address, 'address'),
    linkedAccId: text(row.linkedAccId, 'linkedAccId'),
    linkedCustomerId: text(row.linkedCustomerId, 'linkedCustomerId'),
    linkedCourierId: text(row.linkedCourierId, 'linkedCourierId'),
    linkedSourceId: text(row.linkedSourceId, 'linkedSourceId'),
    financialAccountId: text(row.financialAccountId, 'financialAccountId'),
    financialAccountCode: text(row.financialAccountCode, 'financialAccountCode'),
    financialCurrency: text(row.financialCurrency, 'financialCurrency'),
    joinBy: text(row.joinBy, 'joinBy'),
    referrerId: text(row.referrerId, 'referrerId'),
  };
}

const identityColumns = `portal_user_id AS "portalUserId",
  COALESCE(NULLIF(username, ''), NULLIF(data ->> 'username', ''), '') AS username,
  COALESCE(NULLIF(email, ''), NULLIF(data ->> 'email', ''), '') AS email,
  COALESCE(NULLIF(full_name, ''), NULLIF(data ->> 'fullName', ''), '') AS "fullName",
  COALESCE(NULLIF(phone, ''), NULLIF(data ->> 'phone', ''), '') AS phone,
  CASE WHEN data ->> 'portalRole' IN ('customer', 'courier', 'supplier')
       THEN data ->> 'portalRole' ELSE portal_role END AS "portalRole",
  CASE WHEN data ->> 'approvalStatus' IN ('approved', 'pending_approval', 'rejected')
       THEN data ->> 'approvalStatus' ELSE approval_status END AS "approvalStatus",
  CASE WHEN data ->> 'onboardingCompleted' IN ('true', 'false')
       THEN (data ->> 'onboardingCompleted')::boolean ELSE COALESCE(onboarding_completed, false) END AS "onboardingCompleted",
  (COALESCE(disabled, false) OR COALESCE(is_disabled, false)
    OR CASE WHEN data ->> 'disabled' IN ('true', 'false') THEN (data ->> 'disabled')::boolean ELSE false END) AS disabled,
  CASE WHEN EXISTS (
    SELECT 1 FROM alx_api_private.portal_registration_details details
    WHERE details.portal_user_id = public.portal_users.portal_user_id
  ) THEN (
    SELECT details.address FROM alx_api_private.portal_registration_details details
    WHERE details.portal_user_id = public.portal_users.portal_user_id
  ) ELSE NULLIF(data ->> 'address', '') END AS address,
  COALESCE(NULLIF(linked_customer_id, ''), NULLIF(data ->> 'linkedCustomerId', '')) AS "linkedCustomerId",
  data ->> 'linkedAccId' AS "linkedAccId",
  data ->> 'linkedCourierId' AS "linkedCourierId",
  data ->> 'linkedSourceId' AS "linkedSourceId",
  data ->> 'financialAccountId' AS "financialAccountId",
  data ->> 'financialAccountCode' AS "financialAccountCode",
  data ->> 'financialCurrency' AS "financialCurrency",
  COALESCE(NULLIF(join_by, ''), NULLIF(data ->> 'joinBy', '')) AS "joinBy",
  COALESCE(NULLIF(referrer_id, ''), NULLIF(data ->> 'referrerId', '')) AS "referrerId",
  type, data`;

async function withTransaction<Result>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'Portal Auth transaction and rollback both failed.',
        { cause: rollbackError },
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

async function findIdentityById(pool: Pool, portalUserId: string): Promise<PortalAuthIdentity | null> {
  const result = await pool.query<Record<string, unknown>>(
    `SELECT ${identityColumns}
       FROM public.portal_users
      WHERE portal_user_id = $1
      LIMIT 1`,
    [portalUserId],
  );
  return result.rows[0] ? identity(result.rows[0]) : null;
}

export function createPortalAuthRepository(pool: Pool): PortalAuthRepository {
  return {
    async findIdentityByIdentifier(identifier) {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT ${identityColumns}
           FROM public.portal_users
          WHERE lower(COALESCE(NULLIF(email, ''), NULLIF(data ->> 'email', ''), '')) = lower($1)
             OR lower(COALESCE(NULLIF(username, ''), NULLIF(data ->> 'username', ''), '')) = lower($1)
             OR COALESCE(NULLIF(phone, ''), NULLIF(data ->> 'phone', ''), '') = $1
          LIMIT 1`,
        [identifier.trim()],
      );
      return result.rows[0] ? identity(result.rows[0]) : null;
    },

    findIdentityById(portalUserId) {
      return findIdentityById(pool, portalUserId);
    },

    async findCredential(portalUserId): Promise<PortalAuthCredential | null> {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT password_hash AS "passwordHash", password_algorithm AS "passwordAlgorithm"
           FROM alx_api_private.portal_credentials
          WHERE portal_user_id = $1
          LIMIT 1`,
        [portalUserId],
      );
      const row = result.rows[0];
      if (!row || row.passwordAlgorithm !== 'argon2id') return null;
      return { passwordHash: String(row.passwordHash), passwordAlgorithm: 'argon2id' };
    },

    async createSession(input) {
      await withTransaction(pool, async (client) => {
        await client.query(
          `INSERT INTO alx_api_private.portal_sessions
             (session_id, portal_user_id, created_at, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [input.sessionId, input.portalUserId, input.createdAt, input.expiresAt],
        );
        await client.query(
          `INSERT INTO alx_api_private.portal_refresh_tokens
             (token_id, session_id, portal_user_id, family_id, token_hash, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), input.sessionId, input.portalUserId, input.familyId, input.refreshTokenHash, input.createdAt, input.expiresAt],
        );
        await client.query(
          `INSERT INTO alx_api_private.portal_auth_events (portal_user_id, event_type, success, created_at)
           VALUES ($1, 'login.success', true, $2)`,
          [input.portalUserId, input.createdAt],
        );
      });
    },

    async findRefreshToken(tokenHash) {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT token_id AS "tokenId", session_id AS "sessionId", portal_user_id AS "portalUserId",
                family_id AS "familyId", expires_at AS "expiresAt", used_at AS "usedAt",
                revoked_at AS "revokedAt", s.expires_at AS "sessionExpiresAt", s.revoked_at AS "sessionRevokedAt"
           FROM alx_api_private.portal_refresh_tokens r
           JOIN alx_api_private.portal_sessions s ON s.session_id = r.session_id
          WHERE r.token_hash = $1
          LIMIT 1`,
        [tokenHash],
      );
      const row = result.rows[0];
      return row ? {
        tokenId: String(row.tokenId),
        sessionId: String(row.sessionId),
        portalUserId: String(row.portalUserId),
        familyId: String(row.familyId),
        expiresAt: new Date(String(row.expiresAt)),
        sessionExpiresAt: new Date(String(row.sessionExpiresAt)),
        sessionRevokedAt: row.sessionRevokedAt ? new Date(String(row.sessionRevokedAt)) : null,
        usedAt: row.usedAt ? new Date(String(row.usedAt)) : null,
        revokedAt: row.revokedAt ? new Date(String(row.revokedAt)) : null,
      } : null;
    },

    async rotateRefreshToken(input) {
      return withTransaction(pool, async (client) => {
        const consumed = await client.query<{
          token_id: string;
          session_id: string;
          portal_user_id: string;
          family_id: string;
        }>(
          `UPDATE alx_api_private.portal_refresh_tokens
              SET used_at = $1
            WHERE token_hash = $2
              AND used_at IS NULL
              AND revoked_at IS NULL
              AND expires_at > $1
              AND EXISTS (
                SELECT 1
                  FROM alx_api_private.portal_sessions s
                 WHERE s.session_id = portal_refresh_tokens.session_id
                   AND s.revoked_at IS NULL
                   AND s.expires_at > $1
              )
            RETURNING token_id, session_id, portal_user_id, family_id`,
          [input.rotatedAt, input.oldTokenHash],
        );
        const token = consumed.rows[0];
        if (!token) return false;

        await client.query(
          `INSERT INTO alx_api_private.portal_refresh_tokens
             (token_id, session_id, portal_user_id, family_id, parent_token_id, token_hash, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [input.newTokenId, token.session_id, token.portal_user_id, token.family_id, token.token_id, input.newTokenHash, input.rotatedAt, input.newExpiresAt],
        );
        await client.query(
          `UPDATE alx_api_private.portal_refresh_tokens
              SET replaced_by_token_id = $1
            WHERE token_id = $2`,
          [input.newTokenId, token.token_id],
        );
        await client.query(
          `UPDATE alx_api_private.portal_sessions
              SET last_used_at = $1
            WHERE session_id = $2`,
          [input.rotatedAt, token.session_id],
        );
        return true;
      });
    },

    async revokeRefreshToken(tokenHash, revokedAt) {
      await pool.query(
        `UPDATE alx_api_private.portal_refresh_tokens
            SET revoked_at = $1
          WHERE token_hash = $2 AND revoked_at IS NULL`,
        [revokedAt, tokenHash],
      );
    },

    async revokeRefreshTokenFamily(familyId, revokedAt) {
      await withTransaction(pool, async (client) => {
        await client.query(
          `UPDATE alx_api_private.portal_refresh_tokens
              SET revoked_at = $1
            WHERE family_id = $2 AND revoked_at IS NULL`,
          [revokedAt, familyId],
        );
        await client.query(
          `UPDATE alx_api_private.portal_sessions
              SET revoked_at = $1, revoke_reason = 'refresh_token_reuse'
            WHERE revoked_at IS NULL
              AND session_id IN (
                SELECT session_id
                  FROM alx_api_private.portal_refresh_tokens
                 WHERE family_id = $2
              )`,
          [revokedAt, familyId],
        );
      });
    },

    async revokeSession(sessionId, reason, revokedAt) {
      await withTransaction(pool, async (client) => {
        await client.query(
          `UPDATE alx_api_private.portal_sessions
              SET revoked_at = $1, revoke_reason = $2
            WHERE session_id = $3 AND revoked_at IS NULL`,
          [revokedAt, reason, sessionId],
        );
        await client.query(
          `UPDATE alx_api_private.portal_refresh_tokens
              SET revoked_at = $1
            WHERE session_id = $2 AND revoked_at IS NULL`,
          [revokedAt, sessionId],
        );
      });
    },

    async revokeAllSessions(portalUserId, reason, revokedAt) {
      await withTransaction(pool, async (client) => {
        await client.query(
          `UPDATE alx_api_private.portal_sessions
              SET revoked_at = $1, revoke_reason = $2
            WHERE portal_user_id = $3 AND revoked_at IS NULL`,
          [revokedAt, reason, portalUserId],
        );
        await client.query(
          `UPDATE alx_api_private.portal_refresh_tokens
              SET revoked_at = $1
            WHERE portal_user_id = $2 AND revoked_at IS NULL`,
          [revokedAt, portalUserId],
        );
      });
    },

    async updatePassword(input) {
      await withTransaction(pool, async (client) => {
        await client.query(
          `INSERT INTO alx_api_private.portal_credentials (portal_user_id, password_hash, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (portal_user_id) DO UPDATE
             SET password_hash = EXCLUDED.password_hash,
                 password_version = alx_api_private.portal_credentials.password_version + 1,
                 updated_at = EXCLUDED.updated_at`,
          [input.portalUserId, input.passwordHash, input.changedAt],
        );
        await client.query(
          `UPDATE alx_api_private.portal_sessions
              SET revoked_at = $1, revoke_reason = 'password_change'
            WHERE portal_user_id = $2 AND revoked_at IS NULL`,
          [input.changedAt, input.portalUserId],
        );
        await client.query(
          `UPDATE alx_api_private.portal_refresh_tokens
              SET revoked_at = $1
            WHERE portal_user_id = $2 AND revoked_at IS NULL`,
          [input.changedAt, input.portalUserId],
        );
        await client.query(
          `INSERT INTO alx_api_private.portal_auth_events
             (portal_user_id, event_type, success, created_at)
           VALUES ($1, 'password.change', true, $2)`,
          [input.portalUserId, input.changedAt],
        );
      });
    },

    async createPortalUser(input) {
      return withTransaction(pool, async (client) => {
        const roleEntityType = input.role === 'supplier' ? 'source' : input.role;
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `portal-registration:${input.email.toLowerCase()}`,
        ]);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `portal-username:${input.username.toLowerCase()}`,
        ]);

        const duplicate = await client.query(
          `SELECT 1
             FROM public.portal_users
            WHERE lower(COALESCE(NULLIF(email, ''), NULLIF(data ->> 'email', ''), '')) = lower($1)
               OR lower(COALESCE(NULLIF(username, ''), NULLIF(data ->> 'username', ''), '')) = lower($2)
            LIMIT 1`,
          [input.email, input.username],
        );
        if (duplicate.rowCount) throw new Error('PORTAL_ACCOUNT_EXISTS');

        const groupResult = await client.query<Record<string, unknown>>(
          `SELECT acc_sub_group_id AS "groupId", acc_sub_id AS "subAccountId", account_code AS "accountCode"
            FROM public.acc_sub_group
            WHERE entity_type = $1 AND is_active IS TRUE AND allows_direct_accounts IS TRUE
            ORDER BY account_code
            LIMIT 1`,
          [roleEntityType],
        );
        const accountGroup = groupResult.rows[0];
        if (!accountGroup) throw new Error('PORTAL_ACCOUNTING_GROUP_NOT_CONFIGURED');

        const currencyResult = await client.query<Record<string, unknown>>(
          `SELECT cur_id AS "currencyNo", code
            FROM public.currency
            WHERE is_active IS TRUE AND is_default IS TRUE
            ORDER BY cur_id
            LIMIT 1`,
        );
        const currencyRow = currencyResult.rows[0];
        if (!currencyRow) throw new Error('PORTAL_DEFAULT_CURRENCY_NOT_CONFIGURED');

        const prefix = String(accountGroup.accountCode);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `financial-account-sequence:${prefix}`,
        ]);
        const sequenceResult = await client.query<{ nextSequence: number }>(
          `SELECT COALESCE(MAX(GREATEST(
                    COALESCE(account_seq, 0),
                    CASE WHEN account_number ~ '^[0-9]+$' THEN account_number::integer ELSE 0 END,
                    CASE WHEN account_code ~ ('^' || $2 || '-[0-9]+$')
                         THEN split_part(account_code, '-', 2)::integer ELSE 0 END
                  )), 0) + 1 AS "nextSequence"
             FROM public.accounts
            WHERE group_id = $1 OR account_prefix = $2 OR account_code LIKE ($2 || '-%')`,
          [accountGroup.groupId, prefix],
        );
        const accountNumber = String(sequenceResult.rows[0]?.nextSequence ?? 1).padStart(4, '0');
        const accountCode = `${prefix}-${accountNumber}`;
        const accountId = accountCode;
        const entityId = input.role === 'customer'
          ? `cust_${accountNumber}`
          : input.role === 'courier' ? `cour_${accountNumber}` : `src_${accountNumber}`;
        const entityName = input.role === 'supplier' ? (input.companyName || input.fullName) : input.fullName;
        const currency = String(currencyRow.code);
        const now = input.createdAt;
        const accountType = prefix.startsWith('1') ? 'Asset' : 'Liability';

        await client.query(
          `INSERT INTO public.accounts
             (account_id, account_code, account_prefix, account_number, account_seq, type,
              cur_no, currency, limited_balance, balance, debit_total, credit_total, is_active,
              acc_sub_id, group_id, parent_code, entity_type, entity_id, entity_name,
              acc_name_ar, acc_name_en, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 0, 0, true,
                   $9, $10, $3, $11, $12, $13, $14, $15, $16, $17, $17)`,
          [
            accountId,
            accountCode,
            prefix,
            accountNumber,
            Number(accountNumber),
            accountType,
            Number(currencyRow.currencyNo),
            currency,
            accountGroup.subAccountId,
            accountGroup.groupId,
            roleEntityType,
            entityId,
            entityName,
            `حساب ${input.role === 'customer' ? 'العميل' : input.role === 'courier' ? 'المندوب' : 'المورد'} - ${entityName}`,
            `${input.role} account - ${entityName}`,
            'حساب مالي أُنشئ عبر تسجيل بوابة الموقع.',
            now,
          ],
        );

        if (input.role === 'customer') {
          await client.query(
            `INSERT INTO public.customers
               (customer_id, account_id, is_active, join_by, referrer_id, full_name, address,
                onboarding_completed, created_at, updated_at)
             VALUES ($1, $2, true, $3, $4, $5, $6, false, $7, $7)`,
            [entityId, accountId, input.joinBy || null, input.referrerId || null, input.fullName, input.address || null, now],
          );
        } else if (input.role === 'courier') {
          await client.query(
            `INSERT INTO public.couriers
               (courier_id, account_id, currency, is_active, full_name, courier_type,
                commission_rate, created_at, updated_at)
             VALUES ($1, $2, $3, false, $4, $5, 0, $6, $6)`,
            [entityId, accountId, currency, input.fullName, input.courierType ?? 'local', now],
          );
        } else {
          await client.query(
            `INSERT INTO public.sources
               (source_id, account_id, name, name_ar, name_en, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $3, $3, false, $4, $4)`,
            [entityId, accountId, entityName, now],
          );
        }

        const extraData = {
          linkedAccId: entityId,
          ...(input.role === 'customer' ? { linkedCustomerId: entityId } : {}),
          ...(input.role === 'courier' ? { linkedCourierId: entityId } : {}),
          ...(input.role === 'supplier' ? { linkedSourceId: entityId } : {}),
          financialAccountId: accountId,
          financialAccountCode: accountCode,
          financialBalance: 0,
          financialCurrency: currency,
          joinBy: input.joinBy || '',
          referrerId: input.referrerId || '',
          onboardingCompleted: input.onboardingCompleted,
        };
        await client.query(
          `INSERT INTO public.portal_users
             (portal_user_id, type, phone, portal_role, username, email, disabled,
              approval_status, full_name, onboarding_completed, join_by, referrer_id,
              linked_customer_id, data, created_at, updated_at)
           VALUES ($1, $2, $3, $2, $4, $5, false, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $13)`,
          [
            input.portalUserId,
            input.role,
            input.phone,
            input.username,
            input.email,
            input.approvalStatus,
            input.fullName,
            input.onboardingCompleted,
            input.joinBy || null,
            input.referrerId || null,
            input.role === 'customer' ? entityId : null,
            JSON.stringify(extraData),
            now,
          ],
        );

        await client.query(
          `INSERT INTO alx_api_private.portal_registration_details
             (portal_user_id, address, company_name, commercial_register, courier_type,
              identity_doc_note, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [
            input.portalUserId,
            input.address || null,
            input.companyName || null,
            input.commercialRegister || null,
            input.courierType || null,
            input.identityDocNote || null,
            now,
          ],
        );

        if (input.role === 'customer') {
          await client.query(
            `INSERT INTO public.cust_details
               (cust_detail_id, user_uid, customer_id, join_by, referrer_id,
                onboarding_completed, data, created_at, updated_at)
             VALUES ($1, $1, $2, $3, $4, false, $5::jsonb, $6, $6)`,
            [
              input.portalUserId,
              entityId,
              input.joinBy || null,
              input.referrerId || null,
              JSON.stringify({
                privacyPolicyAgreed: false,
                joinBy: input.joinBy || '',
                referrerId: input.referrerId || '',
                onboardingCompleted: false,
                createdAt: now.getTime(),
                updatedAt: now.getTime(),
              }),
              now,
            ],
          );
        }

        await client.query(
          `INSERT INTO alx_api_private.portal_credentials (portal_user_id, password_hash, updated_at)
           VALUES ($1, $2, $3)`,
          [input.portalUserId, input.passwordHash, now],
        );
        await client.query(
          `INSERT INTO alx_api_private.portal_auth_events (portal_user_id, event_type, success, created_at)
           VALUES ($1, 'registration.success', true, $2)`,
          [input.portalUserId, now],
        );

        const created = await client.query<Record<string, unknown>>(
          `SELECT ${identityColumns} FROM public.portal_users WHERE portal_user_id = $1 LIMIT 1`,
          [input.portalUserId],
        );
        if (!created.rows[0]) throw new Error('PORTAL_USER_CREATE_FAILED');
        return identity(created.rows[0]);
      });
    },

    async updatePortalProfile(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<Record<string, unknown>>(
          `UPDATE public.portal_users
              SET full_name = COALESCE($2, full_name),
                  phone = COALESCE($3, phone),
                  updated_at = $4
            WHERE portal_user_id = $1
            RETURNING portal_role AS "portalRole", linked_customer_id AS "linkedCustomerId", data`,
          [input.portalUserId, input.fullName ?? null, input.phone ?? null, input.updatedAt],
        );
        const row = result.rows[0];
        if (!row) throw new Error('PORTAL_USER_NOT_FOUND');

        const data = typeof row.data === 'object' && row.data !== null
          ? row.data as Record<string, unknown>
          : {};
        const role = row.portalRole;
        const entityId = role === 'customer'
          ? row.linkedCustomerId ?? data.linkedCustomerId ?? data.linkedAccId
          : role === 'courier'
            ? data.linkedCourierId ?? data.linkedAccId
            : data.linkedSourceId ?? data.linkedAccId;

        if (input.address !== undefined) {
          await client.query(
            `INSERT INTO alx_api_private.portal_registration_details
               (portal_user_id, address, created_at, updated_at)
             VALUES ($1, $2, $3, $3)
             ON CONFLICT (portal_user_id) DO UPDATE
               SET address = EXCLUDED.address, updated_at = EXCLUDED.updated_at`,
            [input.portalUserId, input.address.trim() || null, input.updatedAt],
          );
        }

        if (typeof entityId === 'string' && entityId.length > 0 && role === 'customer') {
          await client.query(
            `UPDATE public.customers
                SET full_name = COALESCE($2, full_name),
                    address = CASE WHEN $5 THEN $3 ELSE address END,
                    updated_at = $4
              WHERE customer_id = $1`,
            [entityId, input.fullName ?? null, input.address?.trim() || null, input.updatedAt, input.address !== undefined],
          );
        } else if (typeof entityId === 'string' && entityId.length > 0 && role === 'courier') {
          await client.query(
            `UPDATE public.couriers
                SET full_name = COALESCE($2, full_name), updated_at = $3
              WHERE courier_id = $1`,
            [entityId, input.fullName ?? null, input.updatedAt],
          );
        } else if (typeof entityId === 'string' && entityId.length > 0 && role === 'supplier') {
          await client.query(
            `UPDATE public.sources
                SET name = COALESCE($2, name), updated_at = $3
              WHERE source_id = $1`,
            [entityId, input.fullName ?? null, input.updatedAt],
          );
        }

        const updatedIdentity = await client.query<Record<string, unknown>>(
          `SELECT ${identityColumns} FROM public.portal_users WHERE portal_user_id = $1 LIMIT 1`,
          [input.portalUserId],
        );
        if (!updatedIdentity.rows[0]) throw new Error('PORTAL_USER_NOT_FOUND');
        return identity(updatedIdentity.rows[0]);
      });
    },

    async recordEvent(input) {
      await pool.query(
        `INSERT INTO alx_api_private.portal_auth_events
           (portal_user_id, event_type, success, created_at)
         VALUES ($1, $2, $3, $4)`,
        [input.portalUserId, input.eventType, input.success, input.occurredAt],
      );
    },
  };
}
