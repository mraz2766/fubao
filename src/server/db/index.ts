import { env } from 'cloudflare:workers';
export const db = () => env.DB;
export async function all<T>(query: string, ...bindings: (string | number | null)[]) {
  return (
    await db()
      .prepare(query)
      .bind(...bindings)
      .all<T>()
  ).results;
}
export function first<T>(query: string, ...bindings: (string | number | null)[]) {
  return db()
    .prepare(query)
    .bind(...bindings)
    .first<T>();
}
export function statement(query: string, ...bindings: (string | number | null)[]) {
  return db()
    .prepare(query)
    .bind(...bindings);
}
export async function ownerId() {
  return (
    (await first<{ id: string }>('SELECT id FROM users ORDER BY created_at LIMIT 1'))?.id ?? null
  );
}
