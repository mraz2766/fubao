import type { APIContext } from 'astro';
import { z } from 'zod';
import { json, readJSON, requireUser, HttpError } from './http';
import {
  listTrips,
  listWishlist,
  saveTrip,
  deleteTrip,
  uploadPhoto,
  cleanupStorage,
} from './services/travel';
import { idSchema, visibilitySchema } from '../lib/schemas';
import { first, statement } from './db';
export async function travelRoute(context: APIContext, parts: string[]) {
  const [resource, id] = parts,
    method = context.request.method;
  if (resource === 'entries') {
    if (method === 'GET') {
      const items = await listTrips(context.locals.user, id);
      if (id) {
        if (!items[0]) throw new HttpError(404, 'NOT_FOUND');
        return json(items[0]);
      }
      const page = Math.max(0, Number(context.url.searchParams.get('page')) || 0);
      return json({
        items: items.slice(page * 12, page * 12 + 12),
        hasMore: items.length > (page + 1) * 12,
      });
    }
    const user = requireUser(context);
    if (method === 'POST' || method === 'PUT')
      return json(await saveTrip(user.id, await readJSON(context.request)));
    if (method === 'DELETE' && id) {
      await deleteTrip(user.id, id);
      return json({ ok: true });
    }
  }
  if (resource === 'photos' && method === 'POST')
    return json(await uploadPhoto(requireUser(context).id, context.request), 201);
  if (resource === 'wishlist') {
    if (method === 'GET') return json({ items: await listWishlist(context.locals.user) });
    const user = requireUser(context);
    if (method === 'POST') {
      const values = z
        .object({
          id: idSchema,
          location_id: idSchema,
          spot_id: idSchema.nullable().optional(),
          visibility: visibilitySchema,
        })
        .parse(await readJSON(context.request));
      if (
        values.spot_id &&
        !(await first(
          'SELECT id FROM scenic_spots WHERE id=? AND location_id=?',
          values.spot_id,
          values.location_id,
        ))
      )
        throw new HttpError(400, 'INVALID_INPUT');
      const existing = await first<{ user_id: string }>(
        'SELECT user_id FROM travel_wishlist WHERE id=?',
        values.id,
      );
      if (existing && existing.user_id !== user.id) throw new HttpError(404, 'NOT_FOUND');
      await statement(
        'INSERT INTO travel_wishlist(id,user_id,location_id,visibility,created_at,spot_id) VALUES(?,?,?,?,?,?) ON CONFLICT DO UPDATE SET visibility=excluded.visibility',
        values.id,
        user.id,
        values.location_id,
        values.visibility,
        new Date().toISOString(),
        values.spot_id ?? null,
      ).run();
      return json({ ok: true });
    }
    if (method === 'DELETE' && id) {
      await statement('DELETE FROM travel_wishlist WHERE id=? AND user_id=?', id, user.id).run();
      return json({ ok: true });
    }
  }
  if (resource === 'cleanup' && method === 'POST') {
    requireUser(context);
    return json(await cleanupStorage());
  }
  throw new HttpError(404, 'NOT_FOUND');
}
