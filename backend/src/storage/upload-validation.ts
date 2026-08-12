import { BadRequestException } from '@nestjs/common';
import { sniffFileExtension } from './file-content';
import { FILE_KINDS, FileExtension, FileKind } from './file-kind';
import { UploadedFile } from './uploaded-file.interface';

const asMegabytes = (bytes: number): string =>
  (bytes / (1024 * 1024)).toFixed(1);

/**
 * Per-kind admission check, answering 400 on every rejection.
 *
 * This is the layer the ticket's "rejet en 400" refers to, and it only ever
 * sees a request multer already accepted. `MULTER_HARD_LIMIT_BYTES` is a
 * separate, coarser guard: multer aborts the stream past it and Nest answers
 * 413, which is the honest code for a body that was never fully read. So the
 * two limits are not redundant — the hard one protects the process memory, this
 * one enforces the product rule, and a file between the two lands here as a 400.
 */

export interface ValidatedUpload {
  extension: FileExtension;
  content: Buffer;
}

export function validateUploadedFile(
  kind: FileKind,
  file: UploadedFile | undefined,
): ValidatedUpload {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestException(
      'A file is required, under the "file" field.',
    );
  }

  const definition = FILE_KINDS[kind];

  // `file.size` is reported alongside the part, `buffer.length` is what was
  // actually received and is what the storage will hold. Only the second one
  // cannot be understated by the client.
  if (file.buffer.length > definition.maxBytes) {
    throw new BadRequestException(
      `A ${kind} may not exceed ${asMegabytes(definition.maxBytes)} MB.`,
    );
  }

  const extension = sniffFileExtension(file.buffer);
  if (extension === null || !definition.extensions.includes(extension)) {
    throw new BadRequestException(
      `A ${kind} must be one of: ${definition.extensions.join(', ')}.`,
    );
  }

  return { extension, content: file.buffer };
}
