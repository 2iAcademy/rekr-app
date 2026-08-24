/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ROLE_THEMES } from './roleTheme';

/**
 * `data-role` couples components to the palette scopes in `index.css` through a
 * bare string, and it has drifted twice (French scopes vs English `UserType`
 * values), each time showing up only as silently wrong colours.
 *
 * Vitest neutralises every CSS import (`css: false`), so the stylesheet is read
 * from disk rather than imported. That covers both halves: one shared typed
 * source of truth aligned on `UserType` — which is what makes `satisfies
 * RoleTheme` reject a hand-written value in a component — and the scopes that
 * source of truth is supposed to mirror.
 */
describe('thèmes de rôle', () => {
  it('reprend exactement les valeurs de UserType exposées au front', () => {
    expect(ROLE_THEMES).toEqual(['candidate', 'recruiter']);
  });

  it('ne contient aucune des anciennes valeurs françaises', () => {
    for (const value of ['candidat', 'recruteur']) {
      expect(ROLE_THEMES).not.toContain(value);
    }
  });

  it('déclare un jeu de tokens dans index.css pour chaque thème', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const scopes = [...css.matchAll(/\[data-role='([^']+)'\]/g)].map((match) => match[1]);

    expect(scopes.toSorted()).toEqual([...ROLE_THEMES].toSorted());
  });
});
