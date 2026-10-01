import { describe, expect, it } from 'vitest';
import { createTableGateway } from './tableGateway';

describe('table gateway field allowlist', () => {
  it('requires an explicit allowlist containing the id column', () => {
    expect(() => createTableGateway('users', 'user_id', [], (row) => row)).toThrow(/allowlist/);
    expect(() => createTableGateway('users', 'user_id', ['email'], (row) => row)).toThrow(/user_id/);
  });
});
