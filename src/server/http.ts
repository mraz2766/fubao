import { ZodError, flattenError } from 'zod';
import type { APIContext } from 'astro';
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function requireUser(context: APIContext) {
  if (!context.locals.user) throw new HttpError(401, 'UNAUTHORIZED');
  return context.locals.user;
}
export async function readJSON(request: Request, max = 2 * 1024 * 1024): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(400, 'INVALID_INPUT');
  if (Number(request.headers.get('content-length') ?? 0) > max)
    throw new HttpError(413, 'INVALID_INPUT');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_INPUT');
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw new HttpError(413, 'INVALID_INPUT');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, 'INVALID_INPUT');
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return json({ error: { code: 'INVALID_INPUT', fields: flattenError(error).fieldErrors } }, 400);
  if (error instanceof HttpError) return json({ error: { code: error.code } }, error.status);
  console.error('request_failed', error instanceof Error ? error.message : 'unknown');
  return json({ error: { code: 'INTERNAL' } }, 500);
}
export async function endpoint(callback: () => Promise<Response>) {
  try {
    return await callback();
  } catch (error) {
    return errorResponse(error);
  }
}
