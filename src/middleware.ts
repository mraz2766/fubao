import { defineMiddleware } from 'astro:middleware';
import { preferencesSchema } from './lib/schemas';
import { defaultPreferences } from './types/domain';
import { authenticate } from './server/services/auth';
import { getPreferences } from './server/services/settings';
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.locale =
    context.cookies.get('fubao.locale')?.value === 'en-US' ? 'en-US' : 'zh-CN';
  context.locals.preferences = { ...defaultPreferences, language: context.locals.locale };
  const isApi = context.url.pathname.startsWith('/api/');
  if (isApi && !['GET', 'HEAD', 'OPTIONS'].includes(context.request.method)) {
    if (
      context.request.headers.get('origin') !== context.url.origin ||
      context.request.headers.get('x-fubao-csrf') !== '1'
    )
      return new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
  }
  try {
    context.locals.user = await authenticate(context.cookies.get('fubao.session')?.value);
    const needsPreferences =
      !isApi ||
      ['/api/dashboard', '/api/fitness/analytics', '/api/fitness/checkin'].includes(
        context.url.pathname,
      ) ||
      /\/api\/fitness\/templates\/[^/]+\/start$/.test(context.url.pathname);
    if (needsPreferences)
      context.locals.preferences = await getPreferences(context.locals.user?.id);
    if (!context.locals.user) {
      try {
        const display = JSON.parse(
          decodeURIComponent(context.cookies.get('fubao.display')?.value ?? '{}'),
        );
        const { theme, weightUnit, distanceUnit, weekStart, mapStyle } = display;
        const extras = Object.fromEntries(
          Object.entries({ theme, weightUnit, distanceUnit, weekStart, mapStyle }).filter(
            ([, v]) => v !== undefined,
          ),
        );
        const parsed = preferencesSchema.safeParse({ ...context.locals.preferences, ...extras });
        if (parsed.success) context.locals.preferences = parsed.data;
      } catch {}
    }
    context.locals.locale = context.cookies.has('fubao.locale')
      ? context.locals.locale
      : context.locals.preferences.language;
  } catch (error) {
    // Never silently authenticate on an unavailable database. Static shell remains useful before local initialization.
    console.error('identity_unavailable', error instanceof Error ? error.message : 'unknown');
    if (isApi)
      return new Response(JSON.stringify({ error: { code: 'DATABASE_SETUP' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    return new Response(
      `<!doctype html><html lang="${context.locals.locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fubao</title><body style="font:16px system-ui;padding:40px;max-width:600px;margin:auto"><h1>Fubao</h1><p>${context.locals.locale === 'zh-CN' ? '数据库暂时不可用，请完成初始化或稍后重试。' : 'The database is unavailable. Complete setup or try again shortly.'}</p></body></html>`,
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    );
  }
  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
