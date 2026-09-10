import { all, db, first, statement } from '../db';
import {
  defaultPreferences,
  defaultWidgets,
  type Preferences,
  type Widget,
} from '../../types/domain';
import type { SettingsPatch } from '../../lib/settings-patch';
import { preferencesSchema } from '../../lib/schemas';
export async function getPreferences(userId?: string | null): Promise<Preferences> {
  const row = await first<{ preferences: string }>(
    'SELECT preferences FROM user_settings WHERE user_id=COALESCE(?,(SELECT id FROM users ORDER BY created_at LIMIT 1))',
    userId ?? null,
  );
  if (!row) return { ...defaultPreferences };
  const parsed = preferencesSchema.safeParse(JSON.parse(row.preferences));
  return parsed.success ? parsed.data : { ...defaultPreferences };
}
export async function getWidgets(userId?: string): Promise<Widget[]> {
  const rows = await all<{
    key: Widget['key'];
    visible: number;
    size: Widget['size'];
    position: number;
  }>(
    'SELECT key,visible,size,position FROM dashboard_widgets WHERE user_id=COALESCE(?,(SELECT id FROM users ORDER BY created_at LIMIT 1)) ORDER BY position',
    userId ?? null,
  );
  return defaultWidgets
    .map((fallback) => {
      const row = rows.find((r) => r.key === fallback.key);
      return row
        ? { key: row.key, visible: !!row.visible, size: row.size, order: row.position }
        : { ...fallback };
    })
    .sort((a, b) => a.order - b.order);
}

export async function patchSettings(userId: string, patch: SettingsPatch) {
  const queries = [];
  if (patch.preferences && Object.keys(patch.preferences).length) {
    queries.push(
      statement(
        'INSERT INTO user_settings(user_id,preferences) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET preferences=json_patch(user_settings.preferences,?)',
        userId,
        JSON.stringify({ ...defaultPreferences, ...patch.preferences }),
        JSON.stringify(patch.preferences),
      ),
    );
  }
  for (const change of patch.widgets ?? []) {
    const fallback = defaultWidgets.find((w) => w.key === change.key)!;
    queries.push(
      statement(
        'INSERT INTO dashboard_widgets(user_id,key,visible,size,position) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET visible=COALESCE(?,dashboard_widgets.visible),size=COALESCE(?,dashboard_widgets.size)',
        userId,
        change.key,
        +(change.visible ?? fallback.visible),
        change.size ?? fallback.size,
        fallback.order,
        change.visible === undefined ? null : +change.visible,
        change.size ?? null,
      ),
    );
  }
  if (patch.order)
    for (const [position, key] of patch.order.entries()) {
      const fallback = defaultWidgets.find((w) => w.key === key)!;
      queries.push(
        statement(
          'INSERT INTO dashboard_widgets(user_id,key,visible,size,position) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET position=excluded.position',
          userId,
          key,
          +fallback.visible,
          fallback.size,
          position,
        ),
      );
    }
  if (queries.length) await db().batch(queries);
}
export async function savePreferences(userId: string, p: Preferences) {
  await statement(
    'INSERT INTO user_settings(user_id,preferences) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences',
    userId,
    JSON.stringify(p),
  ).run();
}
export async function saveWidgets(userId: string, widgets: Widget[]) {
  await db().batch(
    widgets.map((w) =>
      statement(
        'INSERT INTO dashboard_widgets(user_id,key,visible,size,position) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET visible=excluded.visible,size=excluded.size,position=excluded.position',
        userId,
        w.key,
        +w.visible,
        w.size,
        w.order,
      ),
    ),
  );
}

export async function saveSettings(userId: string, preferences: Preferences, widgets: Widget[]) {
  await db().batch([
    statement(
      'INSERT INTO user_settings(user_id,preferences) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences',
      userId,
      JSON.stringify(preferences),
    ),
    ...widgets.map((w) =>
      statement(
        'INSERT INTO dashboard_widgets(user_id,key,visible,size,position) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET visible=excluded.visible,size=excluded.size,position=excluded.position',
        userId,
        w.key,
        +w.visible,
        w.size,
        w.order,
      ),
    ),
  ]);
}
