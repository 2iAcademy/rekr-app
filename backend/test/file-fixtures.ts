const pad = (head: Buffer, totalBytes: number): Buffer =>
  totalBytes <= head.length
    ? head.subarray(0, totalBytes)
    : Buffer.concat([head, Buffer.alloc(totalBytes - head.length, 0x20)]);

export const pdfBuffer = (totalBytes = 64): Buffer =>
  pad(
    Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n'),
    totalBytes,
  );

export const pngBuffer = (totalBytes = 64): Buffer =>
  pad(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0x00, 0x00, 0x00, 0x0d]),
      Buffer.from('IHDR'),
    ]),
    totalBytes,
  );

export const jpegBuffer = (totalBytes = 64): Buffer =>
  pad(
    Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from([0x00, 0x10]),
      Buffer.from('JFIF\0'),
    ]),
    totalBytes,
  );

export const webpBuffer = (totalBytes = 64): Buffer =>
  pad(
    Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x1a, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP'),
      Buffer.from('VP8 '),
    ]),
    totalBytes,
  );

export const gifBuffer = (totalBytes = 64): Buffer =>
  pad(Buffer.from('GIF89a'), totalBytes);
