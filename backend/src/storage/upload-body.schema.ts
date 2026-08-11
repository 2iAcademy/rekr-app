import { ApiBodyOptions } from '@nestjs/swagger';

/**
 * Swagger description of the single multipart field the upload routes accept.
 *
 * Not `as const`: the readonly arrays it produces do not satisfy
 * `ApiBodyOptions`, and `nest build` — which type-checks with
 * `tsconfig.build.json` — rejects it even though the test run does not.
 */
export const UPLOAD_BODY_SCHEMA: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: {
      file: { type: 'string', format: 'binary' },
    },
  },
};
