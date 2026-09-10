// Source files stay in the browser. Only optimized images cross the upload API.
export const photoLimits = {
  sourceBytes: 80 * 1024 * 1024,
  sourcePixels: 100_000_000,
  largeBytes: 4 * 1024 * 1024,
  thumbnailBytes: 300 * 1024,
  largeEdge: 1920,
  thumbnailEdge: 480,
  count: 6,
} as const;
export type PhotoFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'avif' | 'gif' | 'bmp';
export const sourceMime: Record<PhotoFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
};
export const photoAccept = 'image/*,.heic,.heif,.avif,.jpg,.jpeg,.png,.webp,.gif,.bmp';
export function photoFormat(bytes: Uint8Array): PhotoFormat | null {
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (text(0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') return 'webp';
  if (['GIF87a', 'GIF89a'].includes(text(0, 6))) return 'gif';
  if (text(0, 2) === 'BM') return 'bmp';
  if (text(4, 4) === 'ftyp' && bytes.length >= 16) {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    const brands = [text(8, 4)];
    for (let i = 16; i + 4 <= Math.min(size, bytes.length); i += 4) brands.push(text(i, 4));
    if (brands.some((brand) => ['avif', 'avis'].includes(brand))) return 'avif';
    if (brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)))
      return 'heic';
  }
  return null;
}
export function photoExtension(type: string): 'webp' | 'jpg' {
  return type === 'image/jpeg' ? 'jpg' : 'webp';
}
export function validPhotoObjectKey(key: string, prefix: string, variant: 'large' | 'thumbnail') {
  return ['webp', 'jpg'].some((ext) => key === `${prefix}${variant}.${ext}`);
}
