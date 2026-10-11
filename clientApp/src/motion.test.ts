/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read from disk: the test config turns CSS imports into empty modules.
const globalStyles = readFileSync('src/index.css', 'utf8');

const reducedMotionBlock = (): string => {
  const start = globalStyles.indexOf('@media (prefers-reduced-motion: reduce)');

  return start === -1 ? '' : globalStyles.slice(start);
};

describe('reduced motion', () => {
  // jsdom applies no media query, so the rule itself is what can be checked.
  it('cuts every animation and transition from one global rule', () => {
    const block = reducedMotionBlock();

    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after\s*\{/);
    expect(block).toMatch(/animation-duration: 0\.01ms !important;/);
    expect(block).toMatch(/animation-iteration-count: 1 !important;/);
    expect(block).toMatch(/transition-duration: 0\.01ms !important;/);
    expect(block).toMatch(/scroll-behavior: auto !important;/);
  });
});
