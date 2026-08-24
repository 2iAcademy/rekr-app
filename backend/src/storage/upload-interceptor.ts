import { FileInterceptor } from '@nestjs/platform-express';
import { MULTER_HARD_LIMIT_BYTES } from './file-kind';

/**
 * The single multipart field every upload route accepts.
 *
 * No `storage` option on purpose: multer defaults to memory storage, so
 * `file.buffer` is populated and nothing is ever written under a
 * client-influenced name. Handing multer a destination instead would make it the
 * component that names files on disk, before any validation has run.
 *
 * `files: 1` closes the variant where a caller sends the field twice and the
 * second part quietly wins.
 *
 * `fields: 0` closes the one `fileSize` cannot: that ceiling only ever measures
 * a file part. Busboy defaults `fields` and `parts` to `Infinity` and multer
 * appends every text part to `req.body`, so a body made of nothing but 1 MB text
 * fields is buffered whole before a handler runs. None of these routes reads a
 * body, so the honest limit is zero — which also makes a stray field a 400,
 * as `forbidNonWhitelisted` would answer anywhere else in the API.
 */
export const UploadedFileInterceptor = () =>
  FileInterceptor('file', {
    limits: { fileSize: MULTER_HARD_LIMIT_BYTES, files: 1, fields: 0 },
  });
