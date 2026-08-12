export type FileScope = 'candidates' | 'companies';

export type FileKind = 'picture' | 'cv' | 'logo' | 'cover-image';

export type FileExtension = 'jpg' | 'png' | 'webp' | 'pdf';

export interface FileKindDefinition {
  scope: FileScope;
  extensions: readonly FileExtension[];
  maxBytes: number;
  /**
   * Whether `GET /api/files/<key>` will serve this kind at all.
   *
   * Only `cv` is false, and that flag is the whole of its protection on that
   * route: the key is never checked against a session there, because an
   * unguessable key is what makes an avatar readable by a browser with no token.
   * A CV needs an authenticated owner, so it is served by
   * `GET /api/candidate-profiles/me/cv` instead — a route that takes no key and
   * therefore cannot be pointed at someone else's row.
   */
  publiclyReadable: boolean;
}

const MEGABYTE = 1024 * 1024;

const IMAGE_EXTENSIONS: readonly FileExtension[] = ['jpg', 'png', 'webp'];

export const FILE_KINDS: Record<FileKind, FileKindDefinition> = {
  picture: {
    scope: 'candidates',
    extensions: IMAGE_EXTENSIONS,
    maxBytes: 2 * MEGABYTE,
    publiclyReadable: true,
  },
  cv: {
    scope: 'candidates',
    extensions: ['pdf'],
    maxBytes: 5 * MEGABYTE,
    publiclyReadable: false,
  },
  logo: {
    scope: 'companies',
    extensions: IMAGE_EXTENSIONS,
    maxBytes: 2 * MEGABYTE,
    publiclyReadable: true,
  },
  'cover-image': {
    scope: 'companies',
    extensions: IMAGE_EXTENSIONS,
    maxBytes: 5 * MEGABYTE,
    publiclyReadable: true,
  },
};

export const CONTENT_TYPES: Record<FileExtension, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/**
 * Coarse ceiling applied by multer while the body is still streaming, above the
 * largest per-kind limit. It exists to stop a 2 GB body from being buffered into
 * the process before any of our code runs; past it Nest answers 413, since the
 * request was never fully read. The per-kind limits in `maxBytes` are the
 * product rule and answer 400.
 */
export const MULTER_HARD_LIMIT_BYTES = 10 * MEGABYTE;

const FILE_KIND_NAMES: readonly string[] = Object.keys(FILE_KINDS);

export function isFileKind(value: string): value is FileKind {
  return FILE_KIND_NAMES.includes(value);
}
