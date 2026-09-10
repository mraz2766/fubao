import { it, expect } from 'vitest';
import { webpDimensions } from '../src/lib/image-validation';
function webp() {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode('RIFF'));
  new DataView(bytes.buffer).setUint32(4, 22, true);
  bytes.set(new TextEncoder().encode('WEBPVP8 '), 8);
  new DataView(bytes.buffer).setUint32(16, 10, true);
  bytes.set([0, 0, 0, 0x9d, 0x01, 0x2a, 100, 0, 80, 0], 20);
  return bytes;
}
it('reads WebP dimensions', () =>
  expect(webpDimensions(webp())).toEqual({ width: 100, height: 80 }));
it('rejects other formats and truncated streams', () => {
  expect(webpDimensions(new Uint8Array(100))).toBeNull();
  expect(webpDimensions(webp().slice(0, 27))).toBeNull();
});
it('rejects EXIF-bearing images', () => {
  const original = webp(),
    bytes = new Uint8Array(40);
  bytes.set(original);
  new DataView(bytes.buffer).setUint32(4, 32, true);
  bytes.set(new TextEncoder().encode('EXIF'), 30);
  new DataView(bytes.buffer).setUint32(34, 2, true);
  expect(webpDimensions(bytes)).toBeNull();
});
