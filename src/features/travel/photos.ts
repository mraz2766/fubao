import type { TravelPhoto } from '../../types/domain';
import { ApiFailure } from '../../lib/api';
export interface PhotoSuggestion {
  latitude?: number;
  longitude?: number;
  date?: string;
}
export interface PreparedPhoto {
  id: string;
  preview: string;
  large: Blob;
  thumbnail: Blob;
  metadata: PhotoSuggestion;
}
async function encode(bitmap: ImageBitmap, longest: number, quality: number, maxSize: number) {
  const ratio = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ApiFailure('INVALID_FILE');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  );
  if (!blob || blob.type !== 'image/webp') throw new ApiFailure('INVALID_FILE');
  if (blob.size > maxSize) {
    if (quality > 0.5) return encode(bitmap, longest, quality - 0.12, maxSize);
    throw new ApiFailure('INVALID_FILE');
  }
  return blob;
}
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 30 * 1024 * 1024
  )
    throw new ApiFailure('INVALID_FILE');
  let metadata: PhotoSuggestion = {};
  try {
    const exifr = await import('exifr');
    const raw = await exifr.parse(file);
    if (raw) {
      const date =
        raw.DateTimeOriginal instanceof Date
          ? `${raw.DateTimeOriginal.getFullYear()}-${String(raw.DateTimeOriginal.getMonth() + 1).padStart(2, '0')}-${String(raw.DateTimeOriginal.getDate()).padStart(2, '0')}`
          : undefined;
      metadata = { latitude: raw.latitude, longitude: raw.longitude, date };
    }
  } catch {
    /* EXIF is optional; image decoding still proceeds. */
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ApiFailure('INVALID_FILE');
  }
  try {
    const large = await encode(bitmap, 1920, 0.84, 4 * 1024 * 1024),
      thumbnail = await encode(bitmap, 480, 0.76, 300 * 1024);
    return {
      id: crypto.randomUUID(),
      preview: URL.createObjectURL(thumbnail),
      large,
      thumbnail,
      metadata,
    };
  } finally {
    bitmap.close();
  }
}
export function uploadPrepared(
  photo: PreparedPhoto,
  travelId: string,
  onProgress: (percent: number) => void,
): Promise<TravelPhoto> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest(),
      form = new FormData();
    form.set('id', photo.id);
    form.set('travelId', travelId);
    form.set('large', photo.large, 'large.webp');
    form.set('thumbnail', photo.thumbnail, 'thumbnail.webp');
    request.open('POST', '/api/travel/photos');
    request.setRequestHeader('X-Fubao-CSRF', '1');
    request.timeout = 90000;
    request.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    request.onerror = () => reject(new ApiFailure('NETWORK'));
    request.ontimeout = () => reject(new ApiFailure('NETWORK'));
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText);
        if (request.status >= 200 && request.status < 300) resolve(result);
        else reject(new ApiFailure(result.error?.code ?? 'INTERNAL'));
      } catch {
        reject(new ApiFailure('INTERNAL'));
      }
    };
    request.send(form);
  });
}
