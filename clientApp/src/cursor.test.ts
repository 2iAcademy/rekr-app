/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read from disk: the test config turns CSS imports into empty modules.
const globalStyles = readFileSync('src/index.css', 'utf8');

const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('pointer cursor', () => {
  it('comes from one global rule over every pressable element', () => {
    expect(globalStyles).toMatch(/button.*\[role='button'\].*\{\s*cursor: pointer;/s);
  });

  // A class added call by call is forgotten on the next component.
  it('is never repeated component by component', () => {
    const offenders = Object.entries(sources)
      .filter(([, source]) => source.includes('cursor-pointer'))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
