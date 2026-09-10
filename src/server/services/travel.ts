import { all, db, first, ownerId, statement } from '../db';
import { HttpError } from '../http';
import { storage } from '../storage';
import { tripSchema, idSchema } from '../../lib/schemas';
import { webpDimensions } from '../../lib/image-validation';
import type { User, Trip, TravelPhoto, Location, Wish } from '../../types/domain';
type TripRow = Omit<Trip, 'photos' | 'location' | 'tags'> & { tags: string };
export async function listTrips(user: User | null, id?: string): Promise<Trip[]> {
  const owner = user?.id ?? (await ownerId());
  if (!owner) return [];
  const scope = `t.user_id=? AND t.deleted_at IS NULL${user ? '' : " AND t.visibility='public'"}${id ? ' AND t.id=?' : ''}`,
    bindings = id ? [owner, id] : [owner];
  const [entries, photos, locations] = await Promise.all([
    all<TripRow>(
      `SELECT t.* FROM travel_entries t WHERE ${scope} ORDER BY t.start_date IS NULL,t.start_date DESC,t.updated_at DESC`,
      ...bindings,
    ),
    all<TravelPhoto & { travel_id: string }>(
      `SELECT p.* FROM travel_photos p JOIN travel_entries t ON t.id=p.travel_id WHERE ${scope} ORDER BY p.position`,
      ...bindings,
    ),
    all<Location & { travel_id: string }>(
      `SELECT l.*,t.id travel_id,t.spot_id,COALESCE(NULLIF(t.place_name,''),p.name_zh,l.name_zh) name_zh,COALESCE(NULLIF(t.place_name,''),p.name_en,l.name) name,COALESCE(p.latitude,l.latitude) latitude,COALESCE(p.longitude,l.longitude) longitude FROM locations l JOIN travel_entries t ON t.location_id=l.id LEFT JOIN scenic_spots p ON p.id=t.spot_id WHERE ${scope}`,
      ...bindings,
    ),
  ]);
  const locationMap = new Map(locations.map((l) => [l.travel_id, l]));
  const photoMap = new Map<string, TravelPhoto[]>();
  for (const p of photos) {
    const bucket = photoMap.get(p.travel_id) ?? [];
    bucket.push(p);
    photoMap.set(p.travel_id, bucket);
  }
  return entries.map((t) => ({
    ...t,
    tags: JSON.parse(t.tags),
    location: locationMap.get(t.id)!,
    photos: photoMap.get(t.id) ?? [],
  }));
}
export async function listWishlist(user: User | null): Promise<Wish[]> {
  const id = user?.id ?? (await ownerId());
  if (!id) return [];
  const rows = await all<
    Location & { wish_id: string; location_id: string; visibility: Wish['visibility'] }
  >(
    `SELECT l.*,w.id wish_id,w.location_id,w.visibility,w.spot_id,COALESCE(p.name_zh,l.name_zh) name_zh,COALESCE(p.name_en,l.name) name FROM travel_wishlist w JOIN locations l ON l.id=w.location_id LEFT JOIN scenic_spots p ON p.id=w.spot_id WHERE w.user_id=?${user ? '' : " AND w.visibility='public'"} ORDER BY w.created_at DESC`,
    id,
  );
  return rows.map((r) => ({
    id: r.wish_id,
    spot_id: r.spot_id,
    location_id: r.location_id,
    visibility: r.visibility,
    location: r,
  }));
}
interface UploadRow extends TravelPhoto {
  user_id: string;
  travel_id: string;
  attached: number;
}
export async function uploadPhoto(userId: string, request: Request) {
  const max = 4 * 1024 * 1024 + 300 * 1024 + 16384;
  if (Number(request.headers.get('content-length') ?? 0) > max)
    throw new HttpError(413, 'INVALID_FILE');
  // Bound multipart decoding even when Content-Length is absent.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_FILE');
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw new HttpError(413, 'INVALID_FILE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const form = await new Response(bytes, {
    headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
  }).formData();
  const id = idSchema.parse(form.get('id')),
    travelId = idSchema.parse(form.get('travelId'));
  const existing = await first<UploadRow>('SELECT * FROM media_uploads WHERE id=?', id);
  if (existing) {
    if (existing.user_id !== userId || existing.travel_id !== travelId)
      throw new HttpError(404, 'NOT_FOUND');
    return existing;
  }
  const parent = await first<{ user_id: string; deleted_at: string | null }>(
    'SELECT user_id,deleted_at FROM travel_entries WHERE id=?',
    travelId,
  );
  if (parent && (parent.user_id !== userId || parent.deleted_at))
    throw new HttpError(404, 'NOT_FOUND');
  const large = form.get('large'),
    thumbnail = form.get('thumbnail');
  if (
    !large ||
    typeof large === 'string' ||
    !thumbnail ||
    typeof thumbnail === 'string' ||
    large.type !== 'image/webp' ||
    thumbnail.type !== 'image/webp' ||
    large.size > 4 * 1024 * 1024 ||
    thumbnail.size > 300 * 1024
  )
    throw new HttpError(400, 'INVALID_FILE');
  const largeBytes = new Uint8Array(await large.arrayBuffer()),
    thumbBytes = new Uint8Array(await thumbnail.arrayBuffer()),
    dimensions = webpDimensions(largeBytes),
    thumbDimensions = webpDimensions(thumbBytes);
  if (
    !dimensions ||
    !thumbDimensions ||
    Math.max(dimensions.width, dimensions.height) > 1920 ||
    Math.max(thumbDimensions.width, thumbDimensions.height) > 480
  )
    throw new HttpError(400, 'INVALID_FILE');
  const prefix = `travel/${userId}/${travelId}/${id}`,
    largeKey = `${prefix}/large.webp`,
    thumbnailKey = `${prefix}/thumbnail.webp`;
  try {
    await storage.put(largeKey, largeBytes, 'image/webp');
    await storage.put(thumbnailKey, thumbBytes, 'image/webp');
    const result = await statement(
      'INSERT INTO media_uploads(id,user_id,travel_id,large_key,thumbnail_key,width,height,size,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM media_uploads WHERE user_id=? AND travel_id=? AND attached=0)<12',
      id,
      userId,
      travelId,
      largeKey,
      thumbnailKey,
      dimensions.width,
      dimensions.height,
      large.size,
      Date.now(),
      userId,
      travelId,
    ).run();
    if (!result.meta.changes) throw new HttpError(400, 'PHOTO_REQUIRED');
  } catch (error) {
    await queueCleanup([largeKey, thumbnailKey]);
    throw error;
  }
  return {
    id,
    large_key: largeKey,
    thumbnail_key: thumbnailKey,
    width: dimensions.width,
    height: dimensions.height,
    size: large.size,
    position: 0,
  };
}
export async function saveTrip(userId: string, input: unknown) {
  const trip = tripSchema.parse(input),
    existing = await first<{ user_id: string; updated_at: string; deleted_at: string | null }>(
      'SELECT user_id,updated_at,deleted_at FROM travel_entries WHERE id=?',
      trip.id,
    );
  if (existing && (existing.user_id !== userId || existing.deleted_at))
    throw new HttpError(404, 'NOT_FOUND');
  if (existing && trip.updated_at && existing.updated_at !== trip.updated_at)
    throw new HttpError(409, 'CONFLICT');
  if (
    trip.spot_id &&
    !(await first(
      'SELECT id FROM scenic_spots WHERE id=? AND location_id=?',
      trip.spot_id,
      trip.location_id,
    ))
  )
    throw new HttpError(400, 'INVALID_INPUT');
  const oldPhotos = await all<TravelPhoto>(
    'SELECT * FROM travel_photos WHERE travel_id=?',
    trip.id,
  );
  const uploads = await all<UploadRow>(
    'SELECT * FROM media_uploads WHERE user_id=? AND travel_id=?',
    userId,
    trip.id,
  );
  const photos = trip.photo_ids.map(
    (id) => oldPhotos.find((p) => p.id === id) ?? uploads.find((p) => p.id === id),
  );
  if (photos.some((p) => !p)) throw new HttpError(400, 'PHOTO_REQUIRED');
  const valid = photos as TravelPhoto[];
  const exists = await Promise.all(
    valid.flatMap((p) => [storage.exists(p.large_key), storage.exists(p.thumbnail_key)]),
  );
  if (exists.some((v) => !v)) throw new HttpError(400, 'MISSING_PHOTOS');
  const removed = oldPhotos.filter((p) => !trip.photo_ids.includes(p.id));
  const statements = [
    statement(
      `INSERT INTO travel_entries(id,user_id,location_id,start_date,end_date,description,tags,rating,visibility,updated_at,spot_id,place_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET location_id=excluded.location_id,start_date=excluded.start_date,end_date=excluded.end_date,description=excluded.description,tags=excluded.tags,rating=excluded.rating,visibility=excluded.visibility,updated_at=excluded.updated_at,spot_id=excluded.spot_id,place_name=excluded.place_name`,
      trip.id,
      userId,
      trip.location_id,
      trip.start_date,
      trip.end_date,
      trip.description,
      JSON.stringify(trip.tags),
      trip.rating,
      trip.visibility,
      new Date().toISOString(),
      trip.spot_id ?? null,
      trip.place_name,
    ),
    statement('DELETE FROM travel_photos WHERE travel_id=?', trip.id),
  ];
  valid.forEach((p, i) => {
    statements.push(
      statement(
        'INSERT INTO travel_photos(id,travel_id,large_key,thumbnail_key,width,height,size,position) VALUES(?,?,?,?,?,?,?,?)',
        p.id,
        trip.id,
        p.large_key,
        p.thumbnail_key,
        p.width,
        p.height,
        p.size,
        i,
      ),
    );
    statements.push(
      statement('UPDATE media_uploads SET attached=1 WHERE id=? AND user_id=?', p.id, userId),
    );
  });
  for (const p of removed)
    for (const key of [p.large_key, p.thumbnail_key]) statements.push(cleanupStatement(key));
  await db().batch(statements);
  return (await listTrips({ id: userId, username: '' }, trip.id))[0];
}
const cleanupStatement = (key: string) =>
  statement(
    'INSERT OR IGNORE INTO storage_cleanup_jobs(id,object_key,created_at) VALUES(?,?,?)',
    crypto.randomUUID(),
    key,
    new Date().toISOString(),
  );
export async function queueCleanup(keys: string[]) {
  if (keys.length) await db().batch(keys.map(cleanupStatement));
}
export async function deleteTrip(userId: string, id: string) {
  const trip = (await listTrips({ id: userId, username: '' }, id))[0];
  if (!trip) throw new HttpError(404, 'NOT_FOUND');
  await db().batch([
    statement(
      "UPDATE travel_entries SET deleted_at=?,visibility='private' WHERE id=? AND user_id=?",
      new Date().toISOString(),
      id,
      userId,
    ),
    ...trip.photos.flatMap((p) => [
      cleanupStatement(p.large_key),
      cleanupStatement(p.thumbnail_key),
    ]),
  ]);
}
export async function readPhoto(user: User | null, id: string, variant: string) {
  if (!['large', 'thumbnail'].includes(variant)) throw new HttpError(404, 'NOT_FOUND');
  const photo = await first<
    TravelPhoto & { user_id: string; visibility: string; deleted_at: string | null }
  >(
    'SELECT p.*,t.user_id,t.visibility,t.deleted_at FROM travel_photos p JOIN travel_entries t ON t.id=p.travel_id WHERE p.id=?',
    id,
  );
  if (!photo || photo.deleted_at || (photo.visibility !== 'public' && photo.user_id !== user?.id))
    throw new HttpError(404, 'NOT_FOUND');
  const object = await storage.get(variant === 'large' ? photo.large_key : photo.thumbnail_key);
  if (!object) throw new HttpError(404, 'NOT_FOUND');
  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(object.size),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export async function cleanupStorage() {
  const stale = await all<UploadRow>(
    'SELECT * FROM media_uploads WHERE attached=0 AND created_at<? LIMIT 50',
    Date.now() - 86400000,
  );
  for (const upload of stale) {
    await queueCleanup([upload.large_key, upload.thumbnail_key]);
    await statement('DELETE FROM media_uploads WHERE id=? AND attached=0', upload.id).run();
  }
  const jobs = await all<{ id: string; object_key: string }>(
    'SELECT id,object_key FROM storage_cleanup_jobs ORDER BY created_at LIMIT 100',
  );
  for (const job of jobs) {
    try {
      const referenced = await first<{ id: string }>(
        'SELECT p.id FROM travel_photos p JOIN travel_entries t ON t.id=p.travel_id WHERE t.deleted_at IS NULL AND (p.large_key=? OR p.thumbnail_key=?) LIMIT 1',
        job.object_key,
        job.object_key,
      );
      if (!referenced) await storage.delete(job.object_key);
      await statement('DELETE FROM storage_cleanup_jobs WHERE id=?', job.id).run();
    } catch (error) {
      await statement(
        'UPDATE storage_cleanup_jobs SET attempts=attempts+1,last_error=? WHERE id=?',
        error instanceof Error ? error.message.slice(0, 200) : 'storage_error',
        job.id,
      ).run();
    }
  }
  return { processed: jobs.length };
}
