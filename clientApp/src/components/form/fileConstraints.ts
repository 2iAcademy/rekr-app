/**
 * Mirrors `backend/src/storage/file-kind.ts`: the extensions and the per-slot
 * size caps the API enforces, so a file the server would answer 400 on is
 * refused before the upload starts.
 *
 * `jpeg` is listed next to `jpg` on purpose. The backend decides the type by
 * sniffing the magic bytes and normalises a JPEG to `jpg`, so it never sees the
 * name — but the file picker does, and refusing `photo.jpeg` would be a client
 * rule the server does not have.
 */
const MEGABYTE = 1024 * 1024;

export type FileSlot = 'picture' | 'cv' | 'logo' | 'coverImage';

export interface FileConstraint {
  extensions: readonly string[];
  maxBytes: number;
}

const IMAGE_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png', 'webp'];

export const FILE_CONSTRAINTS: Readonly<Record<FileSlot, FileConstraint>> = {
  picture: { extensions: IMAGE_EXTENSIONS, maxBytes: 2 * MEGABYTE },
  cv: { extensions: ['pdf'], maxBytes: 5 * MEGABYTE },
  logo: { extensions: IMAGE_EXTENSIONS, maxBytes: 2 * MEGABYTE },
  coverImage: { extensions: IMAGE_EXTENSIONS, maxBytes: 5 * MEGABYTE },
};

/** Value for the native input's `accept`: a filter for the picker, never a guarantee. */
export const acceptAttribute = (constraint: FileConstraint): string =>
  constraint.extensions.map((extension) => `.${extension}`).join(',');

export const extensionsLabel = (constraint: FileConstraint): string => {
  const upper = constraint.extensions.map((extension) => extension.toUpperCase());
  if (upper.length === 1) {
    return upper[0];
  }

  return `${upper.slice(0, -1).join(', ')} ou ${upper[upper.length - 1]}`;
};

export const maxSizeLabel = (constraint: FileConstraint): string => {
  const megabytes = constraint.maxBytes / MEGABYTE;
  const rendered = Number.isInteger(megabytes)
    ? String(megabytes)
    : megabytes.toFixed(1).replace('.', ',');

  return `${rendered} Mo`;
};

export const constraintHint = (constraint: FileConstraint): string =>
  `${extensionsLabel(constraint)} — ${maxSizeLabel(constraint)} maximum.`;

const extensionOf = (name: string): string | null => {
  const dot = name.lastIndexOf('.');

  return dot === -1 ? null : name.slice(dot + 1).toLowerCase();
};

/** Returns the reason to show the user, or `null` when the file is acceptable. */
export const validateFile = (file: File, constraint: FileConstraint): string | null => {
  const extension = extensionOf(file.name);
  if (extension === null || !constraint.extensions.includes(extension)) {
    return `Format non accepté : choisissez un fichier ${extensionsLabel(constraint)}.`;
  }

  // The API answers 400 on an empty buffer; without this the user would get a
  // server error for a file the picker was happy to hand over.
  if (file.size === 0) {
    return 'Ce fichier est vide.';
  }

  if (file.size > constraint.maxBytes) {
    return `Fichier trop volumineux : ${maxSizeLabel(constraint)} maximum.`;
  }

  return null;
};
