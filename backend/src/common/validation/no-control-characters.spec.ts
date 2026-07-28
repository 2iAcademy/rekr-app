import { containsControlCharacters } from './no-control-characters';

const chr = (code: number): string => String.fromCharCode(code);

describe('containsControlCharacters', () => {
  it('flags the NUL byte that Postgres rejects with SQLSTATE 22021', () => {
    expect(containsControlCharacters(chr(0))).toBe(true);
    expect(containsControlCharacters(`prefix${chr(0)}suffix`)).toBe(true);
  });

  it('flags terminal escape sequences', () => {
    expect(containsControlCharacters(`${chr(27)}[2J`)).toBe(true);
  });

  it('flags DEL and the C1 range', () => {
    expect(containsControlCharacters(chr(0x7f))).toBe(true);
    expect(containsControlCharacters(chr(0x9f))).toBe(true);
  });

  it('allows tab, newline and carriage return so stack traces survive', () => {
    expect(
      containsControlCharacters('Error: boom\n\tat foo (bar.ts:1:1)\r'),
    ).toBe(false);
  });

  it('allows ordinary text, accents and emoji', () => {
    expect(containsControlCharacters('React / Vue — développeur 🚀')).toBe(
      false,
    );
  });

  it('allows the empty string', () => {
    expect(containsControlCharacters('')).toBe(false);
  });
});
