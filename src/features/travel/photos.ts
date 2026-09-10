import type { TravelPhoto } from '../../types/domain';
import { ApiFailure } from '../../lib/api';
import { photoFormat, sourceMime, photoLimits, photoExtension } from '../../lib/photo-policy';
import { jpegWithoutMetadata } from '../../lib/image-validation';
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
interface DecodedPhoto {
  image: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}
async function encode(source: DecodedPhoto, longest: number, quality: number, maxSize: number) {
  const canvas = document.createElement('canvas');
  try {
    // Reduce quality, then dimensions; difficult/noisy photos should not fail at one preset.
    for (const scale of [1, 0.8, 0.6, 0.4]) {
      const ratio = Math.min(1, (longest * scale) / Math.max(source.width, source.height));
      canvas.width = Math.max(1, Math.round(source.width * ratio));
      canvas.height = Math.max(1, Math.round(source.height * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ApiFailure('PHOTO_ENCODE');
      ctx.drawImage(source.image, 0, 0, canvas.width, canvas.height);
      let type = 'image/webp';
      for (const q of [quality, 0.68, 0.52]) {
        let blob = await canvasBlob(canvas, type, q);
        if (!blob || blob.type !== type) {
          // Canvas may return PNG when WebP encoding is unsupported (not an invalid source).
          type = 'image/jpeg';
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(source.image, 0, 0, canvas.width, canvas.height);
          blob = await canvasBlob(canvas, type, q);
        }
        if (!blob || blob.type !== type) throw new ApiFailure('PHOTO_ENCODE');
        if (type === 'image/jpeg') {
          const bytes = jpegWithoutMetadata(new Uint8Array(await blob.arrayBuffer()));
          if (!bytes) throw new ApiFailure('PHOTO_ENCODE');
          blob = new Blob([bytes], { type });
        }
        if (blob.size > 0 && blob.size <= maxSize) return blob;
      }
    }
    throw new ApiFailure('PHOTO_ENCODE');
  } finally {
    // Release iOS canvas backing stores promptly, especially during multi-photo uploads.
    canvas.width = canvas.height = 1;
  }
}
async function nativeDecode(file: Blob): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === 'function') {
    try {
      const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image, width: image.width, height: image.height, release: () => image.close() };
    } catch {
      /* Some browsers decode more formats via an image element. */
    }
  }
  const url = URL.createObjectURL(file),
    image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        image.src = '';
        reject(new ApiFailure('PHOTO_DECODE'));
      }, 30000);
      image.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new ApiFailure('PHOTO_DECODE'));
      };
      image.src = url;
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => {
        image.src = '';
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
export async function preparePhoto(
  file: File,
  id: string = crypto.randomUUID(),
): Promise<PreparedPhoto> {
  if (!file.size) throw new ApiFailure('PHOTO_EMPTY');
  if (file.size > photoLimits.sourceBytes) throw new ApiFailure('PHOTO_TOO_LARGE');
  const format = photoFormat(new Uint8Array(await file.slice(0, 256).arrayBuffer()));
  if (!format) throw new ApiFailure('PHOTO_FORMAT');
  // File.type may be blank, application/octet-stream, or a nonstandard image/jpg alias.
  const source = file.slice(0, file.size, sourceMime[format]);
  let metadata: PhotoSuggestion = {};
  try {
    const exifr = await import('exifr');
    const raw = await exifr.parse(source);
    if (raw) {
      const date =
        raw.DateTimeOriginal instanceof Date && !Number.isNaN(raw.DateTimeOriginal.getTime())
          ? `${raw.DateTimeOriginal.getFullYear()}-${String(raw.DateTimeOriginal.getMonth() + 1).padStart(2, '0')}-${String(raw.DateTimeOriginal.getDate()).padStart(2, '0')}`
          : undefined;
      metadata = {
        latitude: Number.isFinite(raw.latitude) ? raw.latitude : undefined,
        longitude: Number.isFinite(raw.longitude) ? raw.longitude : undefined,
        date,
      };
    }
  } catch {
    /* EXIF suggestions are optional. */
  }
  let decoded: DecodedPhoto;
  try {
    decoded = await nativeDecode(source);
  } catch {
    if (format !== 'heic') throw new ApiFailure('PHOTO_DECODE');
    // No converter is loaded for normal uploads or initial page views.
    const { decodeHeic } = await import('./heic-decoder');
    const image = await decodeHeic(source);
    decoded = { image, width: image.width, height: image.height, release: () => image.close() };
  }
  try {
    if (!decoded.width || !decoded.height) throw new ApiFailure('PHOTO_DECODE');
    if (decoded.width * decoded.height > photoLimits.sourcePixels)
      throw new ApiFailure('PHOTO_PIXELS');
    const large = await encode(decoded, photoLimits.largeEdge, 0.84, photoLimits.largeBytes);
    const thumbnail = await encode(
      decoded,
      photoLimits.thumbnailEdge,
      0.76,
      photoLimits.thumbnailBytes,
    );
    return { id, preview: URL.createObjectURL(thumbnail), large, thumbnail, metadata };
  } finally {
    decoded.release();
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
    form.set('large', photo.large, `large.${photoExtension(photo.large.type)}`);
    form.set('thumbnail', photo.thumbnail, `thumbnail.${photoExtension(photo.thumbnail.type)}`);
    request.open('POST', '/api/travel/photos');
    request.setRequestHeader('X-Fubao-CSRF', '1');
    request.timeout = 120000;
    request.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    request.onerror = () => reject(new ApiFailure('NETWORK'));
    request.onabort = () => reject(new ApiFailure('NETWORK'));
    request.ontimeout = () => reject(new ApiFailure('PHOTO_UPLOAD_TIMEOUT'));
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText);
        if (request.status >= 200 && request.status < 300) resolve(result);
        else
          reject(
            new ApiFailure(
              result.error?.code ?? (request.status === 413 ? 'PHOTO_UPLOAD_SIZE' : 'INTERNAL'),
            ),
          );
      } catch {
        reject(new ApiFailure(request.status === 413 ? 'PHOTO_UPLOAD_SIZE' : 'NETWORK'));
      }
    };
    request.send(form);
  });
}
