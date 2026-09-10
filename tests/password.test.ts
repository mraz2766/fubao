import { it, expect } from 'vitest';
import { hashPassword, verifyPassword, tokenHash } from '../src/server/services/password';
it('salts passwords independently and verifies credentials', async () => {
  const a = await hashPassword('fubao'),
    b = await hashPassword('fubao');
  expect(a).not.toBe(b);
  expect(a).not.toContain('fubao');
  expect(await verifyPassword('fubao', a)).toBe(true);
  expect(await verifyPassword('wrong', a)).toBe(false);
}, 15000);
it('stores a one-way digest of session tokens', async () =>
  expect(await tokenHash('session-token')).toMatch(/^[a-f0-9]{64}$/));
