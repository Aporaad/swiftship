import {
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign as signBytes,
  verify as verifyBytes,
  type KeyObject,
} from 'node:crypto';
import { z } from 'zod';
import type { AccessTokenIssuer } from './auth.use-cases';

const headerSchema = z.object({ alg: z.literal('EdDSA'), typ: z.literal('JWT') }).strict();
const claimsSchema = z.object({
  iss: z.string().min(1).max(200),
  aud: z.string().min(1).max(200),
  sub: z.string().min(1).max(200),
  sid: z.string().min(1).max(200),
  jti: z.string().uuid(),
  role: z.string().min(1).max(100),
  iat: z.number().int().nonnegative(),
  nbf: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
}).strict();

export type AccessTokenClaims = z.infer<typeof claimsSchema>;

export class InvalidAccessTokenError extends Error {
  constructor() {
    super('Access token is invalid or expired.');
    this.name = 'InvalidAccessTokenError';
  }
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

function requireEd25519Key(key: KeyObject): KeyObject {
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new TypeError('An Ed25519 key is required for access tokens.');
  }
  return key;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new InvalidAccessTokenError();
  }
}

export class Ed25519AccessTokenIssuer implements AccessTokenIssuer {
  private readonly privateKey: KeyObject;

  constructor(
    privateKeyPem: string,
    private readonly issuer: string,
    private readonly audience: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.privateKey = requireEd25519Key(createPrivateKey(normalizePem(privateKeyPem)));
    if (!issuer.trim() || !audience.trim()) throw new TypeError('JWT issuer and audience must be configured.');
  }

  async issue(input: { subject: string; role: string; sessionId: string; expiresInSeconds: number }): Promise<string> {
    if (!Number.isInteger(input.expiresInSeconds) || input.expiresInSeconds < 300 || input.expiresInSeconds > 900) {
      throw new RangeError('Access token lifetime must be between 5 and 15 minutes.');
    }
    const issuedAt = Math.floor(this.now().getTime() / 1_000);
    const header = encodeJson({ alg: 'EdDSA', typ: 'JWT' });
    const payload = encodeJson({
      iss: this.issuer,
      aud: this.audience,
      sub: input.subject,
      sid: input.sessionId,
      jti: randomUUID(),
      role: input.role,
      iat: issuedAt,
      nbf: issuedAt,
      exp: issuedAt + input.expiresInSeconds,
    });
    const signingInput = `${header}.${payload}`;
    const signature = signBytes(null, Buffer.from(signingInput, 'utf8'), this.privateKey).toString('base64url');
    return `${signingInput}.${signature}`;
  }
}

export function verifyAccessToken(
  token: string,
  options: {
    publicKeyPem: string;
    issuer: string;
    audience: string;
    now?: () => Date;
  },
): AccessTokenClaims {
  if (token.length > 8_192) throw new InvalidAccessTokenError();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) throw new InvalidAccessTokenError();
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  if (!encodedHeader || !encodedClaims || !encodedSignature) throw new InvalidAccessTokenError();

  const header = headerSchema.safeParse(decodeJson(encodedHeader));
  const claims = claimsSchema.safeParse(decodeJson(encodedClaims));
  if (!header.success || !claims.success) throw new InvalidAccessTokenError();

  let publicKey: KeyObject;
  try {
    publicKey = requireEd25519Key(createPublicKey(normalizePem(options.publicKeyPem)));
  } catch {
    throw new InvalidAccessTokenError();
  }

  let validSignature: boolean;
  try {
    validSignature = verifyBytes(
      null,
      Buffer.from(`${encodedHeader}.${encodedClaims}`, 'utf8'),
      publicKey,
      Buffer.from(encodedSignature, 'base64url'),
    );
  } catch {
    throw new InvalidAccessTokenError();
  }
  if (!validSignature) throw new InvalidAccessTokenError();

  const value = claims.data;
  const nowSeconds = Math.floor((options.now?.() ?? new Date()).getTime() / 1_000);
  if (
    value.iss !== options.issuer
    || value.aud !== options.audience
    || value.exp <= nowSeconds
    || value.nbf > nowSeconds
    || value.iat > nowSeconds + 30
    || value.exp - value.iat > 900
  ) {
    throw new InvalidAccessTokenError();
  }
  return value;
}
