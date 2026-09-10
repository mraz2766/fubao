import type { APIContext } from 'astro';
import { z } from 'zod';
import { db, first, statement } from '../db';
import { HttpError, json, readJSON, requireUser } from '../http';
import { hashPassword, tokenHash, verifyPassword } from './password';
import type { User } from '../../types/domain';
const cookie = 'fubao.session';
export async function authenticate(token: string | undefined): Promise<User | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return first<User>(
    'SELECT u.id,u.username FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?',
    await tokenHash(token),
    Date.now(),
  );
}
async function limit(key: string) {
  const now = Date.now(),
    window = 15 * 60 * 1000;
  const row = await statement(
    'INSERT INTO login_attempts(key,attempts,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END RETURNING attempts',
    key,
    now,
    now - window,
    now - window,
  ).first<{ attempts: number }>();
  if (row && row.attempts > 10) throw new HttpError(429, 'RATE_LIMITED');
}
export async function authRoute(context: APIContext, action: string) {
  if (action === 'me' && context.request.method === 'GET')
    return json({ user: context.locals.user });
  if (context.request.method !== 'POST') throw new HttpError(405, 'INVALID_INPUT');
  if (action === 'login') {
    const { username, password } = z
      .object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(256) })
      .parse(await readJSON(context.request));
    const ip = context.request.headers.get('cf-connecting-ip') ?? 'local';
    await limit(`ip:${await tokenHash(ip)}`);
    await limit(`user:${username.toLowerCase()}`);
    const user = await first<User & { password_hash: string }>(
      'SELECT id,username,password_hash FROM users WHERE username=?',
      username,
    );
    if (!user || !(await verifyPassword(password, user.password_hash)))
      throw new HttpError(401, 'INVALID_CREDENTIALS');
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await db().batch([
      statement(
        'INSERT INTO auth_sessions(id,user_id,expires_at) VALUES(?,?,?)',
        await tokenHash(token),
        user.id,
        Date.now() + 30 * 86400000,
      ),
      statement('DELETE FROM auth_sessions WHERE expires_at<?', Date.now()),
      statement(
        'DELETE FROM login_attempts WHERE window_start<? OR key=? OR key=?',
        Date.now() - 86400000,
        `ip:${await tokenHash(ip)}`,
        `user:${username.toLowerCase()}`,
      ),
    ]);
    context.cookies.set(cookie, token, {
      httpOnly: true,
      secure: context.url.protocol === 'https:',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 86400,
    });
    return json({ user: { id: user.id, username: user.username } });
  }
  const user = requireUser(context);
  if (action === 'logout') {
    const token = context.cookies.get(cookie)?.value;
    if (token)
      await statement('DELETE FROM auth_sessions WHERE id=?', await tokenHash(token)).run();
    context.cookies.delete(cookie, { path: '/' });
    return json({ ok: true });
  }
  if (action === 'password') {
    const values = z
      .object({
        currentPassword: z.string().min(1).max(256),
        newPassword: z.string().min(5).max(256),
      })
      .parse(await readJSON(context.request));
    await limit(`password:${user.id}`);
    const row = await first<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id=?',
      user.id,
    );
    if (!row || !(await verifyPassword(values.currentPassword, row.password_hash)))
      throw new HttpError(401, 'INVALID_CREDENTIALS');
    await db().batch([
      statement(
        'UPDATE users SET password_hash=? WHERE id=?',
        await hashPassword(values.newPassword),
        user.id,
      ),
      statement('DELETE FROM auth_sessions WHERE user_id=?', user.id),
    ]);
    context.cookies.delete(cookie, { path: '/' });
    return json({ ok: true });
  }
  throw new HttpError(404, 'NOT_FOUND');
}
