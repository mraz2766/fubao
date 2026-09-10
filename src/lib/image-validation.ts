export function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  const u32 = (offset: number) =>
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
  const u24 = (offset: number) =>
    bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
  if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WEBP' || u32(4) + 8 !== bytes.length) return null;
  let dimensions: { width: number; height: number } | null = null,
    hasImage = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = text(offset, 4),
      size = u32(offset + 4),
      data = offset + 8;
    if (data + size > bytes.length) return null;
    if (['EXIF', 'XMP ', 'ANIM', 'ANMF'].includes(type)) return null;
    if (type === 'VP8X') {
      if (size < 10 || bytes[data] & 0b00001110) return null;
      dimensions = { width: u24(data + 4) + 1, height: u24(data + 7) + 1 };
    }
    if (type === 'VP8 ') {
      if (size < 10 || text(data + 3, 3) !== '\x9d\x01\x2a') return null;
      dimensions = {
        width: (bytes[data + 6] | (bytes[data + 7] << 8)) & 16383,
        height: (bytes[data + 8] | (bytes[data + 9] << 8)) & 16383,
      };
      hasImage = true;
    }
    if (type === 'VP8L') {
      if (size < 5 || bytes[data] !== 0x2f) return null;
      const bits = u32(data + 1);
      dimensions = { width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 };
      hasImage = true;
    }
    offset = data + size + (size % 2);
  }
  return hasImage && dimensions && dimensions.width > 0 && dimensions.height > 0
    ? dimensions
    : null;
}
