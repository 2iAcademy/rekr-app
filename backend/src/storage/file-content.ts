/**
 * Content sniffing, because the declared type of an upload is worthless.
 *
 * A multipart part carries whatever `Content-Type` its sender chose, and the
 * file name too. Validating either one means letting the client decide what it
 * just uploaded: `cv.pdf` with `application/pdf` can be a PHP payload, and an
 * SVG announced as `image/png` is stored XSS the day anything renders it inline.
 *
 * So the bytes decide. The extension written into the storage key comes from
 * this function, never from `originalname` — which also removes any need to
 * sanitise a user-supplied file name, since none is ever kept.
 *
 * The four formats accepted here are all raster or PDF. SVG is absent on
 * purpose: it is a document format that executes script, and no amount of
 * header checking makes it safe to serve from our own origin.
 */
import { FileExtension } from './file-kind';

interface Signature {
  extension: FileExtension;
  matches: (content: Buffer) => boolean;
}

const startsWith = (content: Buffer, bytes: readonly number[]): boolean =>
  content.length >= bytes.length &&
  bytes.every((byte, index) => content[index] === byte);

const SIGNATURES: readonly Signature[] = [
  {
    extension: 'pdf',
    matches: (content) => startsWith(content, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  },
  {
    extension: 'png',
    matches: (content) =>
      startsWith(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    extension: 'jpg',
    matches: (content) => startsWith(content, [0xff, 0xd8, 0xff]),
  },
  // RIFF is a container, not a format: WAV and AVI share the first four bytes.
  // The discriminator sits at offset 8, after the 4-byte chunk size.
  {
    extension: 'webp',
    matches: (content) =>
      content.length >= 12 &&
      content.subarray(0, 4).toString('latin1') === 'RIFF' &&
      content.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export function sniffFileExtension(content: Buffer): FileExtension | null {
  return (
    SIGNATURES.find((signature) => signature.matches(content))?.extension ??
    null
  );
}
