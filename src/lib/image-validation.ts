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

/** Inspect all segments, including those between progressive scans. */
function inspectJpeg(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2,
    scan = false,
    hasScan = false;
  let dimensions: { width: number; height: number } | null = null;
  const metadata: { start: number; end: number }[] = [];
  while (offset < bytes.length) {
    if (scan) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset++;
      if (bytes[offset + 1] === 0 || (bytes[offset + 1] >= 0xd0 && bytes[offset + 1] <= 0xd7)) {
        offset += 2;
        continue;
      }
      scan = false;
    }
    const start = offset;
    if (bytes[offset++] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9)
      return hasScan && dimensions && offset === bytes.length ? { dimensions, metadata } : null;
    if (marker === 0xd8 || marker === undefined) return null;
    if (offset + 2 > bytes.length) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xe1, 0xed, 0xfe].includes(marker)) metadata.push({ start, end: offset + length });
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (
        !width ||
        !height ||
        (dimensions && (dimensions.width !== width || dimensions.height !== height))
      )
        return null;
      dimensions = { width, height };
    }
    if (marker === 0xda) {
      if (!dimensions || length < 6) return null;
      scan = hasScan = true;
    }
    offset += length;
  }
  return null;
}
export function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const parsed = inspectJpeg(bytes);
  return parsed && parsed.metadata.length === 0 ? parsed.dimensions : null;
}
/** Safari's canvas encoder adds fresh EXIF/IPTC. Strip these after orientation is baked in. */
export function jpegWithoutMetadata(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const parsed = inspectJpeg(bytes);
  if (!parsed) return null;
  const output = new Uint8Array(
    bytes.length - parsed.metadata.reduce((n, part) => n + part.end - part.start, 0),
  );
  let source = 0,
    target = 0;
  for (const part of parsed.metadata) {
    output.set(bytes.subarray(source, part.start), target);
    target += part.start - source;
    source = part.end;
  }
  output.set(bytes.subarray(source), target);
  return output;
}
export function optimizedImage(bytes: Uint8Array) {
  const webp = webpDimensions(bytes);
  if (webp) return { ...webp, type: 'image/webp' as const, extension: 'webp' as const };
  const jpeg = jpegDimensions(bytes);
  return jpeg ? { ...jpeg, type: 'image/jpeg' as const, extension: 'jpg' as const } : null;
}
