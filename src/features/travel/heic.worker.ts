import { heicTo } from 'heic-to/next';
import { photoLimits } from '../../lib/photo-policy';

self.onmessage = async (event: MessageEvent<Blob>) => {
  let source: ImageBitmap | undefined;
  try {
    source = await heicTo({ blob: event.data, type: 'bitmap' });
    if (source.width * source.height > photoLimits.sourcePixels) throw new Error('PHOTO_PIXELS');
    const ratio = Math.min(1, photoLimits.largeEdge / Math.max(source.width, source.height));
    const bitmap = await createImageBitmap(source, {
      resizeWidth: Math.max(1, Math.round(source.width * ratio)),
      resizeHeight: Math.max(1, Math.round(source.height * ratio)),
      resizeQuality: 'high',
    });
    self.postMessage({ bitmap }, { transfer: [bitmap] });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error && error.message === 'PHOTO_PIXELS'
          ? 'PHOTO_PIXELS'
          : 'PHOTO_HEIC_DECODE',
    });
  } finally {
    source?.close();
  }
};
