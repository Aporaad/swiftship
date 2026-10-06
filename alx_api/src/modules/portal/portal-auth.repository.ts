import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
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
  return {
    portalUserId: String(row.portalUserId),
    username: String(row.username ?? ''),
    email: String(row.email ?? ''),
    fullName: String(row.fullName ?? ''),
    phone: String(row.phone ?? ''),
    role: role(row.portalRole),
    approvalStatus: approval(row.approvalStatus),
    onboardingCompleted: Boolean(row.onboardingCompleted),
    disabled: Boolean(row.disabled),
  };
}

export function createPortalAuthRepository(pool: Pool): PortalAuthRepository {
  return {
    async findIdentityByIdentifier(identifier) {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT portal_user_id AS "portalUserId", username, email, full_name AS "fullName",
                phone, portal_role AS "portalRole", approval_status AS "approvalStatus",
                onboarding_completed AS "onboardingCompleted", disabled
           FROM public.portal_users
          WHERE lower(email) = lower($1) OR lower(username) = lower($1) OR phone = $1
          LIMIT 1`,
        [identifier.trim()],
      );
      return result.rows[0] ? identity(result.rows[0]) : null;
    },
    async findIdentityById(portalUserId) {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT portal_user_id AS "portalUserId", username, email, full_name AS "fullName",
                phone, portal_role AS "portalRole", approval_status AS "approvalStatus",
                onboarding_completed AS "onboardingCompleted", disabled
           FROM public.portal_users WHERE portal_user_id = $1 LIMIT 1`,
        [portalUserId],
      );
      return result.rows[0] ? identity(result.rows[0]) : null;
    },
    async findCredential(portalUserId): Promise<PortalAuthCredential | null> {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT password_hash AS "passwordHash", password_algorithm AS "passwordAlgorithm"
           FROM alx_api_private.portal_credentials WHERE portal_user_id = $1 LIMIT 1`,
        [portalUserId],
      );
      const row = result.rows[0];
      if (!row || row.passwordAlgorithm !== 'argon2id') return null;
      return { passwordHash: String(row.passwordHash), passwordAlgorithm: 'argon2id' };
    },
    async createSession(input) {
      await pool.query('BEGIN');
      try {
        await pool.query(
          `INSERT INTO alx_api_private.portal_sessions
             (session_id, portal_user_id, created_at, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [input.sessionId, input.portalUserId, input.createdAt, input.expiresAt],
        );
        await pool.query(
          `INSERT INTO alx_api_private.portal_refresh_tokens
             (token_id, session_id, portal_user_id, family_id, token_hash, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), input.sessionId, input.portalUserId, input.familyId, input.refreshTokenHash, input.createdAt, input.expiresAt],
        );
        await pool.query(
          `INSERT INTO alx_api_private.portal_auth_events (portal_user_id, event_type, success, created_at)
           VALUES ($1, 'login.success', true, $2)`,
          [input.portalUserId, input.createdAt],
        );
        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    },
    async findRefreshToken(tokenHash) {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT token_id AS "tokenId", session_id AS "sessionId", portal_user_id AS "portalUserId",
                family_id AS "familyId", expires_at AS "expiresAt", used_at AS "usedAt",
                revoked_at AS "revokedAt", s.expires_at AS "sessionExpiresAt", s.revoked_at AS "sessionRevokedAt"
           FROM alx_api_private.portal_refresh_tokens r
           JOIN alx_api_private.portal_sessions s ON s.session_id = r.session_id
          WHERE r.token_hash = $1 LIMIT 1`,
        [tokenHash],
      );
      const row = result.rows[0];
      return row ? {
        tokenId: String(row.tokenId), sessionId: String(row.sessionId), portalUserId: String(row.portalUserId), familyId: String(row.familyId),
        expiresAt: new Date(String(row.expiresAt)), sessionExpiresAt: new Date(String(row.sessionExpiresAt)),
        sessionRevokedAt: row.sessionRevokedAt ? new Date(String(row.sessionRevokedAt)) : null,
        usedAt: row.usedAt ? new Date(String(row.usedAt)) : null, revokedAt: row.revokedAt ? new Date(String(row.revokedAt)) : null,
      } : null;
    },
    async rotateRefreshToken(input) {
      await pool.query('BEGIN');
      try {
        const consumed = await pool.query<{ token_id: string; session_id: string; portal_user_id: string; family_id: string }>(
          `UPDATE alx_api_private.portal_refresh_tokens
              SET used_at = $1
            WHERE token_hash = $2 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $1
            RETURNING token_id, session_id, portal_user_id, family_id`,
          [input.rotatedAt, input.oldTokenHash],
        );
        const token = consumed.rows[0];
        if (!token) { await pool.query('ROLLBACK'); return false; }
        await pool.query(
          `INSERT INTO alx_api_private.portal_refresh_tokens
             (token_id, session_id, portal_user_id, family_id, parent_token_id, token_hash, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [input.newTokenId, token.session_id, token.portal_user_id, token.family_id, token.token_id, input.newTokenHash, input.rotatedAt, input.newExpiresAt],
        );
        await pool.query(
          `UPDATE alx_api_private.portal_refresh_tokens SET replaced_by_token_id = $1 WHERE token_id = $2`,
          [input.newTokenId, token.token_id],
        );
        await pool.query(`UPDATE alx_api_private.portal_sessions SET last_used_at = $1 WHERE session_id = $2`, [input.rotatedAt, token.session_id]);
        await pool.query('COMMIT');
        return true;
      } catch (error) { await pool.query('ROLLBACK'); throw error; }
    },
    async revokeRefreshToken(tokenHash, revokedAt) {
      await pool.query(`UPDATE alx_api_private.portal_refresh_tokens SET revoked_at = $1 WHERE token_hash = $2 AND revoked_at IS NULL`, [revokedAt, tokenHash]);
    },
    async revokeSession(sessionId, reason, revokedAt) {
      await pool.query(`UPDATE alx_api_private.portal_sessions SET revoked_at = $1, revoke_reason = $2 WHERE session_id = $3 AND revoked_at IS NULL`, [revokedAt, reason, sessionId]);
      await pool.query(`UPDATE alx_api_private.portal_refresh_tokens SET revoked_at = $1 WHERE session_id = $2 AND revoked_at IS NULL`, [revokedAt, sessionId]);
    },
    async revokeAllSessions(portalUserId, reason, revokedAt) {
      await pool.query(`UPDATE alx_api_private.portal_sessions SET revoked_at = $1, revoke_reason = $2 WHERE portal_user_id = $3 AND revoked_at IS NULL`, [revokedAt, reason, portalUserId]);
      await pool.query(`UPDATE alx_api_private.portal_refresh_tokens SET revoked_at = $1 WHERE portal_user_id = $2 AND revoked_at IS NULL`, [revokedAt, portalUserId]);
    },
    async updatePassword(input) {
      await pool.query('BEGIN');
      try {
        await pool.query(
          `INSERT INTO alx_api_private.portal_credentials (portal_user_id, password_hash, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (portal_user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash,
             password_version = alx_api_private.portal_credentials.password_version + 1, updated_at = EXCLUDED.updated_at`,
          [input.portalUserId, input.passwordHash, input.changedAt],
        );
        await pool.query(`UPDATE alx_api_private.portal_sessions SET revoked_at = $1, revoke_reason = 'password_change' WHERE portal_user_id = $2 AND revoked_at IS NULL`, [input.changedAt, input.portalUserId]);
        await pool.query(`UPDATE alx_api_private.portal_refresh_tokens SET revoked_at = $1 WHERE portal_user_id = $2 AND revoked_at IS NULL`, [input.changedAt, input.portalUserId]);
        await pool.query(`INSERT INTO alx_api_private.portal_auth_events (portal_user_id, event_type, success, created_at) VALUES ($1, 'password.change', true, $2)`, [input.portalUserId, input.changedAt]);
        await pool.query('COMMIT');
      } catch (error) { await pool.query('ROLLBACK'); throw error; }
    },
    async recordEvent(input) {
      await pool.query(`INSERT INTO alx_api_private.portal_auth_events (portal_user_id, event_type, success, created_at) VALUES ($1, $2, $3, $4)`, [input.portalUserId, input.eventType, input.success, input.occurredAt]);
    },
  };
}
