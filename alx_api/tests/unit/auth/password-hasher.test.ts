import { hashPassword, verifyPassword } from '../../../src/modules/auth/password-hasher';

describe('Argon2id password hashing', () => {
  it('stores a salted Argon2id encoding and verifies only the matching password', async () => {
    const password = 'correct horse battery staple';
    const encoded = await hashPassword(password);

    expect(encoded).toMatch(/^\$argon2id\$v=19\$/);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', encoded)).resolves.toBe(false);
  });

  it('fails closed for malformed and non-Argon2id encodings', async () => {
    await expect(verifyPassword('not-empty', 'plain-text-password')).resolves.toBe(false);
    await expect(verifyPassword('not-empty', '$argon2id$malformed')).resolves.toBe(false);
  });

  it('rejects an empty password before hashing', async () => {
    await expect(hashPassword('')).rejects.toThrow('Password must not be empty.');
  });

  it('rejects Argon2id settings outside the approved resource bounds', async () => {
    await expect(hashPassword('secret', {
      memoryCostKiB: 1,
      timeCost: 3,
      parallelism: 1,
    })).rejects.toThrow('Argon2id parameters are outside the permitted resource bounds.');
  });
});
