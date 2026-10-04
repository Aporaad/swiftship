import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
import {
  apiAuthEvents,
  apiLoginUsers,
  apiPermissions,
  apiRefreshTokens,
  apiRolePermissions,
  apiSessions,
  apiUserCredentials,
  apiUserRoles,
  apiUserSecurity,
} from '../../db/schema';
import type { AuthSessionDto } from './auth.contracts';
import type { AuthRepository, AuthUser, PasswordCredential, RefreshTokenRecord } from './auth.use-cases';

const LOCKOUTS = [
  { attempts: 10, durationMs: 60 * 60 * 1_000 },
  { attempts: 5, durationMs: 15 * 60 * 1_000 },
  { attempts: 3, durationMs: 60 * 1_000 },
] as const;

/**
 * PostgreSQL persistence for Auth. User lookup is restricted to the dedicated
 * API login view; credential and session data stay in the private schema.
 */
export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findUsersByIdentifier(identifier: string): Promise<readonly AuthUser[]> {
    const rows = await this.db
      .select({
        userId: apiLoginUsers.userId,
        role: apiLoginUsers.role,
        disabled: apiLoginUsers.disabled,
        email: apiLoginUsers.email,
      })
      .from(apiLoginUsers)
      .where(
        or(eq(sql`lower(${apiLoginUsers.username})`, identifier), eq(sql`lower(${apiLoginUsers.email})`, identifier)),
      )
      .limit(2);
    return rows;
  }

  async findCredential(userId: string): Promise<PasswordCredential | null> {
    const [credential] = await this.db
      .select({
        passwordHash: apiUserCredentials.passwordHash,
        passwordAlgorithm: apiUserCredentials.passwordAlgorithm,
      })
      .from(apiUserCredentials)
      .where(eq(apiUserCredentials.userId, userId))
      .limit(1);
    if (!credential || credential.passwordAlgorithm !== 'argon2id') return null;
    return { passwordHash: credential.passwordHash, passwordAlgorithm: 'argon2id' };
  }

  async verifyLegacyPassword(userId: string, password: string): Promise<boolean> {
    const [result] = await this.db
      .select({ valid: sql<boolean>`alx_api_private.verify_legacy_password(${userId}, ${password})` })
      .from(apiLoginUsers)
      .where(eq(apiLoginUsers.userId, userId))
      .limit(1);
    return result?.valid === true;
  }

  async migrateLegacyPassword(input: { userId: string; password: string; passwordHash: string }): Promise<boolean> {
    const [result] = await this.db
      .select({
        migrated: sql<boolean>`alx_api_private.migrate_legacy_password(${input.userId}, ${input.password}, ${input.passwordHash})`,
      })
      .from(apiLoginUsers)
      .where(eq(apiLoginUsers.userId, input.userId))
      .limit(1);
    return result?.migrated === true;
  }

  async getLockedUntil(userId: string): Promise<Date | null> {
    const [security] = await this.db
      .select({ lockedUntil: apiUserSecurity.lockedUntil })
      .from(apiUserSecurity)
      .where(eq(apiUserSecurity.userId, userId))
      .limit(1);
    return security?.lockedUntil ?? null;
  }

  async recordFailedLogin(userId: string, occurredAt: Date): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [security] = await transaction
        .insert(apiUserSecurity)
        .values({ userId, failedLoginAttempts: 1, updatedAt: occurredAt })
        .onConflictDoUpdate({
          target: apiUserSecurity.userId,
          set: {
            failedLoginAttempts: sql`${apiUserSecurity.failedLoginAttempts} + 1`,
            updatedAt: occurredAt,
          },
        })
        .returning({ failedLoginAttempts: apiUserSecurity.failedLoginAttempts });
      if (!security) throw new Error('AUTH_SECURITY_STATE_WRITE_FAILED');

      const lockout = LOCKOUTS.find(({ attempts }) => security.failedLoginAttempts >= attempts);
      await transaction
        .update(apiUserSecurity)
        .set({
          lockedUntil: lockout ? new Date(occurredAt.getTime() + lockout.durationMs) : null,
          updatedAt: occurredAt,
        })
        .where(eq(apiUserSecurity.userId, userId));
    });
  }

  async clearFailedLogins(userId: string, occurredAt: Date): Promise<void> {
    await this.db
      .insert(apiUserSecurity)
      .values({ userId, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: occurredAt, updatedAt: occurredAt })
      .onConflictDoUpdate({
        target: apiUserSecurity.userId,
        set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: occurredAt, updatedAt: occurredAt },
      });
  }

  async createSession(input: {
    sessionId: string;
    familyId: string;
    userId: string;
    refreshTokenHash: string;
    createdAt: Date;
    refreshExpiresAt: Date;
  }): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction.insert(apiSessions).values({
        sessionId: input.sessionId,
        userId: input.userId,
        createdAt: input.createdAt,
        expiresAt: input.refreshExpiresAt,
      });
      await transaction.insert(apiRefreshTokens).values({
        tokenId: randomUUID(),
        sessionId: input.sessionId,
        userId: input.userId,
        familyId: input.familyId,
        tokenHash: input.refreshTokenHash,
        createdAt: input.createdAt,
        expiresAt: input.refreshExpiresAt,
      });
      await transaction.insert(apiAuthEvents).values({
        userId: input.userId,
        eventType: 'auth.login.succeeded',
        success: true,
      });
    });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const [record] = await this.db
      .select({
        userId: apiRefreshTokens.userId,
        role: apiLoginUsers.role,
        disabled: apiLoginUsers.disabled,
        sessionId: apiRefreshTokens.sessionId,
        familyId: apiRefreshTokens.familyId,
        expiresAt: apiRefreshTokens.expiresAt,
        sessionExpiresAt: apiSessions.expiresAt,
        sessionRevokedAt: apiSessions.revokedAt,
        usedAt: apiRefreshTokens.usedAt,
        revokedAt: apiRefreshTokens.revokedAt,
      })
      .from(apiRefreshTokens)
      .innerJoin(apiSessions, eq(apiRefreshTokens.sessionId, apiSessions.sessionId))
      .innerJoin(apiLoginUsers, eq(apiRefreshTokens.userId, apiLoginUsers.userId))
      .where(eq(apiRefreshTokens.tokenHash, tokenHash))
      .limit(1);
    return record ?? null;
  }

  async rotateRefreshToken(input: {
    oldTokenHash: string;
    newTokenHash: string;
    newTokenId: string;
    rotatedAt: Date;
    newExpiresAt: Date;
  }): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const [token] = await transaction
        .select({
          tokenId: apiRefreshTokens.tokenId,
          sessionId: apiRefreshTokens.sessionId,
          userId: apiRefreshTokens.userId,
          familyId: apiRefreshTokens.familyId,
          expiresAt: apiRefreshTokens.expiresAt,
          usedAt: apiRefreshTokens.usedAt,
          revokedAt: apiRefreshTokens.revokedAt,
        })
        .from(apiRefreshTokens)
        .where(eq(apiRefreshTokens.tokenHash, input.oldTokenHash))
        .for('update')
        .limit(1);
      if (!token || token.usedAt || token.revokedAt || token.expiresAt.getTime() <= input.rotatedAt.getTime())
        return false;

      const [session] = await transaction
        .select({ expiresAt: apiSessions.expiresAt, revokedAt: apiSessions.revokedAt })
        .from(apiSessions)
        .where(eq(apiSessions.sessionId, token.sessionId))
        .for('update')
        .limit(1);
      if (!session || session.revokedAt || session.expiresAt.getTime() <= input.rotatedAt.getTime()) return false;

      const [consumed] = await transaction
        .update(apiRefreshTokens)
        .set({ usedAt: input.rotatedAt })
        .where(
          and(
            eq(apiRefreshTokens.tokenId, token.tokenId),
            isNull(apiRefreshTokens.usedAt),
            isNull(apiRefreshTokens.revokedAt),
            gt(apiRefreshTokens.expiresAt, input.rotatedAt),
          ),
        )
        .returning({ tokenId: apiRefreshTokens.tokenId });
      if (!consumed) return false;

      await transaction.insert(apiRefreshTokens).values({
        tokenId: input.newTokenId,
        sessionId: token.sessionId,
        userId: token.userId,
        familyId: token.familyId,
        parentTokenId: token.tokenId,
        tokenHash: input.newTokenHash,
        createdAt: input.rotatedAt,
        expiresAt: input.newExpiresAt,
      });
      await transaction
        .update(apiRefreshTokens)
        .set({ replacedByTokenId: input.newTokenId })
        .where(eq(apiRefreshTokens.tokenId, token.tokenId));
      await transaction
        .update(apiSessions)
        .set({ lastUsedAt: input.rotatedAt })
        .where(eq(apiSessions.sessionId, token.sessionId));
      return true;
    });
  }

  async revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [token] = await transaction
        .select({ sessionId: apiRefreshTokens.sessionId, userId: apiRefreshTokens.userId })
        .from(apiRefreshTokens)
        .where(eq(apiRefreshTokens.tokenHash, tokenHash))
        .for('update')
        .limit(1);
      if (!token) return;
      await transaction
        .update(apiSessions)
        .set({ revokedAt, revokeReason: 'logout' })
        .where(and(eq(apiSessions.sessionId, token.sessionId), isNull(apiSessions.revokedAt)));
      await transaction
        .update(apiRefreshTokens)
        .set({ revokedAt })
        .where(and(eq(apiRefreshTokens.sessionId, token.sessionId), isNull(apiRefreshTokens.revokedAt)));
      await transaction.insert(apiAuthEvents).values({
        userId: token.userId,
        eventType: 'auth.logout',
        success: true,
      });
    });
  }

  async revokeRefreshTokenFamily(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [token] = await transaction
        .select({
          familyId: apiRefreshTokens.familyId,
          sessionId: apiRefreshTokens.sessionId,
          userId: apiRefreshTokens.userId,
        })
        .from(apiRefreshTokens)
        .where(eq(apiRefreshTokens.tokenHash, tokenHash))
        .for('update')
        .limit(1);
      if (!token) return;
      await transaction
        .update(apiRefreshTokens)
        .set({ revokedAt })
        .where(and(eq(apiRefreshTokens.familyId, token.familyId), isNull(apiRefreshTokens.revokedAt)));
      await transaction
        .update(apiSessions)
        .set({ revokedAt, revokeReason: 'refresh_reuse' })
        .where(and(eq(apiSessions.sessionId, token.sessionId), isNull(apiSessions.revokedAt)));
      await transaction.insert(apiAuthEvents).values({
        userId: token.userId,
        eventType: 'auth.refresh.reuse',
        success: false,
      });
    });
  }

  async findActiveSession(input: { userId: string; sessionId: string; now: Date }): Promise<AuthUser | null> {
    const [record] = await this.db
      .select({
        userId: apiLoginUsers.userId,
        role: apiLoginUsers.role,
        disabled: apiLoginUsers.disabled,
      })
      .from(apiSessions)
      .innerJoin(apiLoginUsers, eq(apiSessions.userId, apiLoginUsers.userId))
      .where(
        and(
          eq(apiSessions.sessionId, input.sessionId),
          eq(apiSessions.userId, input.userId),
          isNull(apiSessions.revokedAt),
          gt(apiSessions.expiresAt, input.now),
          eq(apiLoginUsers.disabled, false),
        ),
      )
      .limit(1);
    return record ?? null;
  }

  async listSessions(input: {
    userId: string;
    currentSessionId: string;
    now: Date;
  }): Promise<readonly AuthSessionDto[]> {
    const records = await this.db
      .select({
        sessionId: apiSessions.sessionId,
        createdAt: apiSessions.createdAt,
        lastUsedAt: apiSessions.lastUsedAt,
        expiresAt: apiSessions.expiresAt,
      })
      .from(apiSessions)
      .where(
        and(eq(apiSessions.userId, input.userId), isNull(apiSessions.revokedAt), gt(apiSessions.expiresAt, input.now)),
      )
      .orderBy(desc(apiSessions.createdAt));
    return records.map((record) => ({
      ...record,
      isCurrent: record.sessionId === input.currentSessionId,
    }));
  }

  async revokeSession(input: { userId: string; sessionId: string; revokedAt: Date }): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [revoked] = await transaction
        .update(apiSessions)
        .set({ revokedAt: input.revokedAt, revokeReason: 'user_revoked' })
        .where(
          and(
            eq(apiSessions.userId, input.userId),
            eq(apiSessions.sessionId, input.sessionId),
            isNull(apiSessions.revokedAt),
          ),
        )
        .returning({ sessionId: apiSessions.sessionId });
      if (!revoked) return;
      await transaction
        .update(apiRefreshTokens)
        .set({ revokedAt: input.revokedAt })
        .where(and(eq(apiRefreshTokens.sessionId, revoked.sessionId), isNull(apiRefreshTokens.revokedAt)));
      await transaction.insert(apiAuthEvents).values({
        userId: input.userId,
        eventType: 'auth.session.revoked',
        success: true,
      });
    });
  }

  async revokeAllSessions(input: { userId: string; revokedAt: Date }): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const sessions = await transaction
        .select({ sessionId: apiSessions.sessionId })
        .from(apiSessions)
        .where(and(eq(apiSessions.userId, input.userId), isNull(apiSessions.revokedAt)))
        .for('update');
      const sessionIds = sessions.map(({ sessionId }) => sessionId);
      if (sessionIds.length === 0) return;
      await transaction
        .update(apiSessions)
        .set({ revokedAt: input.revokedAt, revokeReason: 'logout_all' })
        .where(inArray(apiSessions.sessionId, sessionIds));
      await transaction
        .update(apiRefreshTokens)
        .set({ revokedAt: input.revokedAt })
        .where(and(inArray(apiRefreshTokens.sessionId, sessionIds), isNull(apiRefreshTokens.revokedAt)));
      await transaction.insert(apiAuthEvents).values({
        userId: input.userId,
        eventType: 'auth.sessions.revoked_all',
        success: true,
      });
    });
  }

  async recordAuthEvent(input: {
    userId: string | null;
    eventType: string;
    success: boolean;
    occurredAt: Date;
  }): Promise<void> {
    await this.db.insert(apiAuthEvents).values({
      userId: input.userId,
      eventType: input.eventType,
      success: input.success,
      createdAt: input.occurredAt,
    });
  }

  async updatePasswordHash(input: { userId: string; passwordHash: string; changedAt: Date }): Promise<boolean> {
    const [result] = await this.db
      .select({
        changed: sql<boolean>`alx_api_private.update_password_hash(${input.userId}, ${input.passwordHash}, ${input.changedAt})`,
      })
      .from(apiLoginUsers)
      .where(eq(apiLoginUsers.userId, input.userId))
      .limit(1);
    return result?.changed === true;
  }

  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<boolean> {
    const [result] = await this.db
      .select({
        created: sql<boolean>`alx_api_private.create_password_reset_token(${input.userId}, ${input.tokenHash}, ${input.createdAt}, ${input.expiresAt})`,
      })
      .from(apiLoginUsers)
      .where(eq(apiLoginUsers.userId, input.userId))
      .limit(1);
    return result?.created === true;
  }

  async completePasswordReset(input: { tokenHash: string; passwordHash: string; completedAt: Date }): Promise<boolean> {
    const [result] = await this.db
      .select({
        completed: sql<boolean>`alx_api_private.complete_password_reset(${input.tokenHash}, ${input.passwordHash}, ${input.completedAt})`,
      })
      .from(apiLoginUsers)
      .limit(1);
    return result?.completed === true;
  }

  async revokePasswordResetToken(input: { tokenHash: string; revokedAt: Date }): Promise<void> {
    await this.db
      .select({ revoked: sql`alx_api_private.revoke_password_reset_token(${input.tokenHash}, ${input.revokedAt})` })
      .from(apiLoginUsers)
      .limit(1);
  }

  async listPermissions(userId: string): Promise<readonly string[]> {
    const permissions = await this.db
      .select({ code: apiPermissions.code })
      .from(apiUserRoles)
      .innerJoin(apiLoginUsers, eq(apiLoginUsers.userId, apiUserRoles.userId))
      .innerJoin(apiRolePermissions, eq(apiRolePermissions.roleId, apiUserRoles.roleId))
      .innerJoin(apiPermissions, eq(apiPermissions.permissionId, apiRolePermissions.permissionId))
      .where(
        and(
          eq(apiUserRoles.userId, userId),
          eq(apiLoginUsers.disabled, false),
          or(isNull(apiUserRoles.expiresAt), gt(apiUserRoles.expiresAt, new Date())),
        ),
      )
      .orderBy(apiPermissions.code);
    return [...new Set(permissions.map(({ code }) => code))];
  }
}
