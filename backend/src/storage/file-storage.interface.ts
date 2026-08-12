/**
 * The seam between the upload endpoints and wherever bytes actually live.
 *
 * Today there is exactly one production implementation, `LocalFileStorage`,
 * writing to a Docker volume on the VPS. The interface is not here in
 * anticipation of a second one — it is here because the services under test
 * need a double that does not touch the filesystem. `file-storage.spec.ts` runs
 * one shared contract against both, so the double cannot quietly drift from the
 * driver it stands in for.
 *
 * `Buffer` rather than a stream: the largest accepted file is 5 MB and multer's
 * memory storage has already buffered it whole by the time a service is called.
 * A stream API would add lifecycle handling to every call site and buy nothing
 * at this size.
 */
export const FILE_STORAGE = 'FILE_STORAGE';

export interface FileStorage {
  save(key: string, content: Buffer): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}
