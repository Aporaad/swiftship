import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify, type HashOptions } from 'argon2';

export interface Argon2idParameters {
  memoryCostKiB: number;
  timeCost: number;
  parallelism: number;
}

const DEFAULT_PARAMETERS: Argon2idParameters = {
  memoryCostKiB: 65_536,
  timeCost: 3,
  parallelism: 1,
};

function createArgon2idOptions(parameters: Argon2idParameters): HashOptions {
  if (
    !Number.isInteger(parameters.memoryCostKiB) || parameters.memoryCostKiB < 8_192 || parameters.memoryCostKiB > 262_144 ||
    !Number.isInteger(parameters.timeCost) || parameters.timeCost < 1 || parameters.timeCost > 10 ||
    !Number.isInteger(parameters.parallelism) || parameters.parallelism < 1 || parameters.parallelism > 8
  ) {
    throw new RangeError('Argon2id parameters are outside the permitted resource bounds.');
  }

  return {
    type: argon2id,
    memoryCost: parameters.memoryCostKiB,
    timeCost: parameters.timeCost,
    parallelism: parameters.parallelism,
    hashLength: 32,
    salt: randomBytes(16),
  };
}

/** Hashes a password with Argon2id using a unique cryptographic salt. */
export async function hashPassword(
  plainTextPassword: string,
  parameters: Argon2idParameters = DEFAULT_PARAMETERS,
): Promise<string> {
  if (plainTextPassword.length === 0) {
    throw new TypeError('Password must not be empty.');
  }

  return hash(plainTextPassword, createArgon2idOptions(parameters));
}

/**
 * Verifies only Argon2id encodings. Invalid or unsupported encodings fail closed
 * and never include credentials or encoded hashes in thrown errors.
 */
export async function verifyPassword(
  plainTextPassword: string,
  encodedHash: string,
): Promise<boolean> {
  if (plainTextPassword.length === 0 || !encodedHash.startsWith('$argon2id$')) {
    return false;
  }

  try {
    return await verify(encodedHash, plainTextPassword);
  } catch {
    return false;
  }
}
