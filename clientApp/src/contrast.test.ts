/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read from disk: the test config turns CSS imports into empty modules.
const globalStyles = readFileSync('src/index.css', 'utf8');

const block = (selector: string): string => {
  const start = globalStyles.indexOf(`${selector} {`);
  return globalStyles.slice(start, globalStyles.indexOf('}', start));
};

const token = (scope: string, name: string): string => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(block(scope));
  if (!match) throw new Error(`--${name} is not a hex colour in ${scope}`);
  return match[1];
};

const channels = (hex: string): number[] =>
  [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** `color` painted at `alpha` over `background`, as `ring-brand/70` is. */
const over = (color: string, alpha: number, background: string): string =>
  `#${channels(color)
    .map((value, index) => Math.round(value * alpha + channels(background)[index] * (1 - alpha)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;

// RGAA 3.3: what identifies a field, and the focus ring, reach 3:1 against what
// surrounds them, in both themes.
describe.each([':root', '.dark'])('contrastes des composants (%s)', (scope) => {
  const surfaces = [token(scope, 'card'), token(scope, 'background')];

  it('détache la bordure des champs de la carte et de la page', () => {
    for (const surface of surfaces) {
      expect(ratio(token(scope, 'input'), surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it('rend l’anneau de focus visible à 70 % d’opacité', () => {
    for (const surface of surfaces) {
      expect(ratio(over(token(scope, 'brand'), 0.7, surface), surface)).toBeGreaterThanOrEqual(3);
    }
  });
});
