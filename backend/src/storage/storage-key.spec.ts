import { buildStorageKey, isStorageKey, parseStorageKey } from './storage-key';

describe('buildStorageKey', () => {
  it('lays out the key as scope, owner, kind and a random file name', () => {
    const key = buildStorageKey('candidates', 42, 'cv', 'pdf');

    expect(key).toMatch(
      /^candidates\/42\/cv\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
    );
  });

  it('never reuses a file name for the same owner and kind', () => {
    const first = buildStorageKey('candidates', 42, 'picture', 'png');
    const second = buildStorageKey('candidates', 42, 'picture', 'png');

    expect(first).not.toBe(second);
  });

  it('fits the 255 characters the columns can store', () => {
    const key = buildStorageKey(
      'companies',
      Number.MAX_SAFE_INTEGER,
      'logo',
      'webp',
    );

    expect(key.length).toBeLessThanOrEqual(255);
  });

  it('refuses an owner that is not a positive integer', () => {
    expect(() => buildStorageKey('candidates', 0, 'cv', 'pdf')).toThrow();
    expect(() => buildStorageKey('candidates', -1, 'cv', 'pdf')).toThrow();
    expect(() => buildStorageKey('candidates', 1.5, 'cv', 'pdf')).toThrow();
  });

  it('refuses a kind that does not belong to the scope', () => {
    expect(() => buildStorageKey('companies', 1, 'cv', 'pdf')).toThrow();
    expect(() => buildStorageKey('candidates', 1, 'logo', 'png')).toThrow();
  });

  it('refuses an extension the kind does not allow', () => {
    expect(() => buildStorageKey('candidates', 1, 'cv', 'png')).toThrow();
    expect(() => buildStorageKey('candidates', 1, 'picture', 'pdf')).toThrow();
  });

  it('only ever produces keys it recognises back', () => {
    expect(
      isStorageKey(buildStorageKey('candidates', 1, 'picture', 'jpg')),
    ).toBe(true);
    expect(isStorageKey(buildStorageKey('candidates', 1, 'cv', 'pdf'))).toBe(
      true,
    );
    expect(isStorageKey(buildStorageKey('companies', 1, 'logo', 'webp'))).toBe(
      true,
    );
    expect(
      isStorageKey(buildStorageKey('companies', 1, 'cover-image', 'png')),
    ).toBe(true);
  });
});

describe('parseStorageKey', () => {
  it('reads back what buildStorageKey wrote', () => {
    const key = buildStorageKey('companies', 7, 'cover-image', 'jpg');

    expect(parseStorageKey(key)).toEqual({
      scope: 'companies',
      ownerId: 7,
      kind: 'cover-image',
      extension: 'jpg',
    });
  });

  it('returns null for a kind that is not one of the four files', () => {
    expect(
      parseStorageKey(
        'candidates/1/passport/11111111-1111-1111-1111-111111111111.pdf',
      ),
    ).toBeNull();
  });

  it('returns null when the scope does not match the kind', () => {
    expect(
      parseStorageKey(
        'companies/1/cv/11111111-1111-1111-1111-111111111111.pdf',
      ),
    ).toBeNull();
    expect(
      parseStorageKey(
        'candidates/1/logo/11111111-1111-1111-1111-111111111111.png',
      ),
    ).toBeNull();
  });

  it('returns null when the extension is not the one the kind allows', () => {
    expect(
      parseStorageKey(
        'candidates/1/cv/11111111-1111-1111-1111-111111111111.png',
      ),
    ).toBeNull();
    expect(
      parseStorageKey(
        'candidates/1/picture/11111111-1111-1111-1111-111111111111.pdf',
      ),
    ).toBeNull();
  });
});

describe('isStorageKey', () => {
  const validKey =
    'candidates/1/picture/11111111-1111-1111-1111-111111111111.png';

  it('accepts a key it produced itself', () => {
    expect(isStorageKey(validKey)).toBe(true);
    expect(isStorageKey(buildStorageKey('candidates', 3, 'cv', 'pdf'))).toBe(
      true,
    );
  });

  it.each([
    ['parent traversal', '../../../etc/passwd'],
    [
      'traversal inside a valid prefix',
      'candidates/1/picture/../../../../etc/passwd',
    ],
    [
      'a single dot segment',
      'candidates/1/./picture/11111111-1111-1111-1111-111111111111.png',
    ],
    [
      'percent-encoded traversal',
      'candidates/1/picture/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    ],
    [
      'a backslash separator',
      'candidates\\1\\picture\\11111111-1111-1111-1111-111111111111.png',
    ],
    ['an absolute path', '/etc/passwd'],
    ['a Windows absolute path', 'C:\\Windows\\win.ini'],
    [
      'a null byte',
      'candidates/1/picture/11111111-1111-1111-1111-111111111111.png\u0000.txt',
    ],
    [
      'a newline',
      'candidates/1/picture/11111111-1111-1111-1111-111111111111.png\n',
    ],
    ['a home shortcut', '~/.ssh/id_rsa'],
    ['a trailing slash', 'candidates/1/picture/'],
    ['an empty string', ''],
    ['a bare file name', 'passwd'],
    [
      'a leading separator on a valid key',
      '/candidates/1/picture/11111111-1111-1111-1111-111111111111.png',
    ],
    [
      'a double separator',
      'candidates//1/picture/11111111-1111-1111-1111-111111111111.png',
    ],
    ['a non-uuid file name', 'candidates/1/picture/anything.png'],
    [
      'an owner that is not a number',
      'candidates/abc/picture/11111111-1111-1111-1111-111111111111.png',
    ],
    [
      'a padded owner',
      'candidates/0042/picture/11111111-1111-1111-1111-111111111111.png',
    ],
    [
      'an extra segment',
      'candidates/1/picture/sub/11111111-1111-1111-1111-111111111111.png',
    ],
    [
      'an uppercase uuid',
      'candidates/1/picture/AAAAAAAA-1111-1111-1111-111111111111.png',
    ],
    [
      'a double extension',
      'candidates/1/picture/11111111-1111-1111-1111-111111111111.png.php',
    ],
  ])('rejects %s', (_case, candidate) => {
    expect(isStorageKey(candidate)).toBe(false);
  });

  it.each([null, undefined, 42, {}, []])(
    'rejects the non-string %p',
    (candidate) => {
      expect(isStorageKey(candidate)).toBe(false);
    },
  );
});
