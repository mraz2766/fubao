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

import { readFileSync } from 'node:fs';
import { jpegDimensions, jpegWithoutMetadata, optimizedImage } from '../src/lib/image-validation';
import { photoFormat, photoLimits, validPhotoObjectKey } from '../src/lib/photo-policy';
const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL('./fixtures/' + name, import.meta.url)));
it('detects actual file signatures independently of extension or MIME', () => {
  for (const [name, format] of [
    ['photo.jpg', 'jpeg'],
    ['photo.png', 'png'],
    ['photo.avif', 'avif'],
    ['photo.heic', 'heic'],
  ])
    expect(photoFormat(fixture(name!))).toBe(format);
  expect(
    photoFormat(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')),
  ).toBeNull();
  expect(photoLimits.sourceBytes).toBe(80 * 1024 * 1024);
});
it('accepts stripped JPEG output and rejects EXIF or malformed/truncated JPEGs', () => {
  const jpeg = fixture('photo.jpg');
  expect(jpegDimensions(jpeg)).toEqual({ width: 640, height: 480 });
  expect(optimizedImage(jpeg)).toMatchObject({ type: 'image/jpeg', extension: 'jpg' });
  expect(jpegDimensions(fixture('rotated-exif.jpg'))).toBeNull();
  expect(jpegDimensions(jpeg.slice(0, -2))).toBeNull();
  const malicious = new Uint8Array(jpeg.length + 6);
  malicious.set([0xff, 0xd8, 0xff, 0xe1, 0, 4, 0, 0]);
  malicious.set(jpeg.subarray(2), 8);
  expect(jpegDimensions(malicious)).toBeNull();
  const afterScan = new Uint8Array(jpeg.length + 6);
  afterScan.set(jpeg.subarray(0, -2));
  afterScan.set([0xff, 0xe1, 0, 4, 0, 0, 0xff, 0xd9], jpeg.length - 2);
  expect(jpegDimensions(afterScan)).toBeNull();
});
it('backup supports JPEG and legacy WebP without allowing unrelated object keys', () => {
  const prefix = 'travel/owner/trip/photo/';
  expect(validPhotoObjectKey(prefix + 'large.jpg', prefix, 'large')).toBe(true);
  expect(validPhotoObjectKey(prefix + 'thumbnail.webp', prefix, 'thumbnail')).toBe(true);
  expect(validPhotoObjectKey('travel/other/trip/photo/large.jpg', prefix, 'large')).toBe(false);
  expect(validPhotoObjectKey(prefix + '../large.jpg', prefix, 'large')).toBe(false);
});
it('strips Safari canvas EXIF/IPTC while preserving a decodable image', async () => {
  const bytes = fixture('canvas-safari.jpg');
  expect(jpegDimensions(bytes)).toBeNull();
  const clean = jpegWithoutMetadata(bytes)!;
  expect(clean.length).toBeLessThan(bytes.length);
  expect(jpegDimensions(clean)).toEqual({ width: 640, height: 480 });
  const sharp = (await import('sharp')).default;
  const decoded = await sharp(clean).raw().toBuffer({ resolveWithObject: true });
  expect(decoded.info).toMatchObject({ width: 640, height: 480 });
  expect(jpegWithoutMetadata(bytes.slice(0, -2))).toBeNull();
});
