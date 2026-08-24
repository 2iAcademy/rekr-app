import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryFileStorage } from '../../test/in-memory-file-storage';
import { pdfBuffer, pngBuffer } from '../../test/file-fixtures';
import { FileStorage } from './file-storage.interface';
import { LocalFileStorage } from './local-file-storage';
import { buildStorageKey } from './storage-key';

// `storage-key.spec.ts` covers the grammar exhaustively. What is pinned here is
// that both implementations refuse to act on a key that fails it, on all three
// operations — a read-only guard would still leave `save` and `delete` able to
// write and unlink outside the root.
const TRAVERSAL_KEYS = [
  '../../../etc/passwd',
  '/etc/passwd',
  'candidates/1/picture/../../../../etc/passwd',
  'candidates/1/picture/anything.png',
  '',
];

describe.each([
  [
    'LocalFileStorage',
    async (): Promise<{
      storage: FileStorage;
      dispose: () => Promise<void>;
    }> => {
      const root = await mkdtemp(join(tmpdir(), 'rekr-storage-'));
      return {
        storage: new LocalFileStorage(root),
        dispose: () => rm(root, { recursive: true, force: true }),
      };
    },
  ],
  [
    'InMemoryFileStorage',
    (): Promise<{ storage: FileStorage; dispose: () => Promise<void> }> =>
      Promise.resolve({
        storage: new InMemoryFileStorage(),
        dispose: () => Promise.resolve(),
      }),
  ],
])('%s honours the FileStorage contract', (_name, build) => {
  let storage: FileStorage;
  let dispose: () => Promise<void>;

  beforeEach(async () => {
    ({ storage, dispose } = await build());
  });

  afterEach(async () => {
    await dispose();
  });

  it('reads back exactly the bytes it was given', async () => {
    const key = buildStorageKey('candidates', 1, 'cv', 'pdf');
    const content = pdfBuffer();

    await storage.save(key, content);

    expect(await storage.read(key)).toEqual(content);
  });

  it('keeps two keys apart', async () => {
    const cv = buildStorageKey('candidates', 1, 'cv', 'pdf');
    const picture = buildStorageKey('candidates', 1, 'picture', 'png');

    await storage.save(cv, pdfBuffer());
    await storage.save(picture, pngBuffer());

    expect(await storage.read(cv)).toEqual(pdfBuffer());
    expect(await storage.read(picture)).toEqual(pngBuffer());
  });

  it('answers null for a key it never stored', async () => {
    const key = buildStorageKey('candidates', 1, 'cv', 'pdf');

    expect(await storage.read(key)).toBeNull();
  });

  it('forgets a deleted key', async () => {
    const key = buildStorageKey('candidates', 1, 'cv', 'pdf');
    await storage.save(key, pdfBuffer());

    await storage.delete(key);

    expect(await storage.read(key)).toBeNull();
  });

  it('deletes an absent key without complaining', async () => {
    const key = buildStorageKey('candidates', 1, 'cv', 'pdf');

    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it.each(TRAVERSAL_KEYS)(
    'refuses to save under the unsafe key %p',
    async (key) => {
      await expect(storage.save(key, pdfBuffer())).rejects.toThrow();
    },
  );

  it.each(TRAVERSAL_KEYS)('refuses to read the unsafe key %p', async (key) => {
    await expect(storage.read(key)).rejects.toThrow();
  });

  it.each(TRAVERSAL_KEYS)(
    'refuses to delete the unsafe key %p',
    async (key) => {
      await expect(storage.delete(key)).rejects.toThrow();
    },
  );
});

describe('LocalFileStorage', () => {
  let root: string;
  let storage: LocalFileStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'rekr-storage-'));
    storage = new LocalFileStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('lays the file out under the root, following the key segments', async () => {
    const key = buildStorageKey('candidates', 12, 'cv', 'pdf');

    await storage.save(key, pdfBuffer());

    expect(await readFile(join(root, key))).toEqual(pdfBuffer());
  });

  it('creates a root that does not exist yet', async () => {
    const missingRoot = join(root, 'not', 'created', 'yet');
    const key = buildStorageKey('candidates', 1, 'picture', 'png');

    await new LocalFileStorage(missingRoot).save(key, pngBuffer());

    expect((await stat(join(missingRoot, key))).isFile()).toBe(true);
  });

  it('leaves the directory behind when the file is deleted', async () => {
    const key = buildStorageKey('candidates', 1, 'cv', 'pdf');
    await storage.save(key, pdfBuffer());

    await storage.delete(key);

    expect(
      (await stat(join(root, 'candidates', '1', 'cv'))).isDirectory(),
    ).toBe(true);
  });
});
