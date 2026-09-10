import { ApiFailure } from '../../lib/api';

export function decodeHeic(file: Blob): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    // Isolate the decoder heap; terminate it (and its child worker) after each photo.
    const worker = new Worker(new URL('./heic.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = window.setTimeout(() => {
      finish();
      reject(new ApiFailure('PHOTO_PROCESSING_TIMEOUT'));
    }, 90000);
    worker.onmessage = (event: MessageEvent<{ bitmap?: ImageBitmap; error?: string }>) => {
      finish();
      if (event.data.bitmap) resolve(event.data.bitmap);
      else reject(new ApiFailure(event.data.error ?? 'PHOTO_HEIC_DECODE'));
    };
    worker.onerror = () => {
      finish();
      reject(new ApiFailure('PHOTO_HEIC_DECODE'));
    };
    worker.postMessage(file);
  });
}
