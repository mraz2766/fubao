import type { APIContext } from 'astro';
import { z } from 'zod';
import { json, readJSON, requireUser, HttpError } from './http';
import { getPreferences, getWidgets, saveSettings, patchSettings } from './services/settings';
import { settingsPatchSchema } from '../lib/settings-patch';
import { exportBackup, previewBackup, importItem } from './services/backup';
import { preferencesSchema, widgetsSchema } from '../lib/schemas';
export async function settingsRoute(context: APIContext) {
  const user = requireUser(context);
  if (context.request.method === 'GET')
    return json({ preferences: await getPreferences(user.id), widgets: await getWidgets(user.id) });
  if (context.request.method === 'PATCH') {
    const patch = settingsPatchSchema.parse(await readJSON(context.request));
    await patchSettings(user.id, patch);
    return json({ ok: true });
  }
  if (context.request.method === 'PUT') {
    const values = z
      .object({ preferences: preferencesSchema, widgets: widgetsSchema })
      .parse(await readJSON(context.request));
    await saveSettings(user.id, values.preferences, values.widgets);
    return json({ ok: true });
  }
  throw new HttpError(405, 'INVALID_INPUT');
}
export async function dataRoute(context: APIContext, action: string) {
  const user = requireUser(context);
  if (action === 'export' && context.request.method === 'GET')
    return new Response(JSON.stringify(await exportBackup(user), null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="fubao-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'private, no-store',
      },
    });
  if (action === 'preview' && context.request.method === 'POST')
    return json(await previewBackup(user, await readJSON(context.request, 20 * 1024 * 1024)));
  if (action === 'import' && context.request.method === 'POST')
    return json(await importItem(user, await readJSON(context.request)));
  throw new HttpError(404, 'NOT_FOUND');
}
