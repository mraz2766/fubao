import { scrypt } from 'node:crypto';
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (value: string) => Uint8Array.from(value.match(/../g) ?? [], (b) => parseInt(b, 16));
// Workers implements node:crypto natively. Keep the existing scrypt format and work factor.
const derive = (password: string, salt: Uint8Array) =>
  new Promise<Uint8Array>((resolve, reject) => {
    scrypt(
      password,
      salt,
      32,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
  });
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `scrypt$32768$8$1$${hex(salt)}$${hex(await derive(password, salt))}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, n, r, p, salt, expected] = stored.split('$');
  if (
    algorithm !== 'scrypt' ||
    n !== '32768' ||
    r !== '8' ||
    p !== '1' ||
    !/^[a-f0-9]{32}$/.test(salt ?? '') ||
    !/^[a-f0-9]{64}$/.test(expected ?? '')
  )
    return false;
  const hash = await derive(password, unhex(salt));
  const target = unhex(expected);
  let difference = hash.length ^ target.length;
  for (let i = 0; i < hash.length; i++) difference |= hash[i] ^ (target[i] ?? 0);
  return difference === 0;
}
export async function tokenHash(token: string) {
  return hex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))),
  );
}
