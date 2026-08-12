import { FileStorage } from '../src/storage/file-storage.interface';
import { isStorageKey } from '../src/storage/storage-key';

/**
 * Test double for `FileStorage`, held to the same contract in
 * `file-storage.spec.ts`.
 *
 * Every method is `async` even though nothing here waits. Written as
 * `Promise<void>` bodies that throw synchronously, the key check would raise
 * before a promise ever existed — so a caller using `.catch()` would crash on
 * the double and be fine against `LocalFileStorage`, whose `async` methods turn
 * the same throw into a rejection. The shared contract caught precisely that.
 */
export class InMemoryFileStorage implements FileStorage {
  private readonly files = new Map<string, Buffer>();

  async save(key: string, content: Buffer): Promise<void> {
    await Promise.resolve();
    this.files.set(this.assertKey(key), Buffer.from(content));
  }

  async read(key: string): Promise<Buffer | null> {
    await Promise.resolve();
    return this.files.get(this.assertKey(key)) ?? null;
  }

  async delete(key: string): Promise<void> {
    await Promise.resolve();
    this.files.delete(this.assertKey(key));
  }

  keys(): string[] {
    return [...this.files.keys()];
  }

  private assertKey(key: string): string {
    if (!isStorageKey(key)) {
      throw new Error(`Refusing to touch the unsafe storage key "${key}".`);
    }
    return key;
  }
}
