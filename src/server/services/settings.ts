import { all, db, first, statement } from '../db';
import {
  defaultPreferences,
  defaultWidgets,
  type Preferences,
  type Widget,
} from '../../types/domain';
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
export async function getWidgets(): Promise<Widget[]> {
  const rows = await all<{
    key: Widget['key'];
    visible: number;
    size: Widget['size'];
    position: number;
  }>(
    'SELECT key,visible,size,position FROM dashboard_widgets WHERE user_id=(SELECT id FROM users ORDER BY created_at LIMIT 1) ORDER BY position',
  );
  return rows.length
    ? rows.map((r) => ({ key: r.key, visible: !!r.visible, size: r.size, order: r.position }))
    : defaultWidgets;
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
