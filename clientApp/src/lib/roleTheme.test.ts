import { describe, it, expect } from 'vitest';
import { ROLE_THEMES } from './roleTheme';

/**
 * `data-role` couples components to the palette scopes in `index.css` through a
 * bare string, and it has drifted twice (French scopes vs English `UserType`
 * values), each time showing up only as silently wrong colours.
 *
 * Vitest neutralises every CSS import (`css: false`), so a unit test cannot read
 * the stylesheet to prove the two sides agree. What is enforced here is the
 * code-side half: one shared, typed source of truth aligned on `UserType`, which
 * is what makes `satisfies RoleTheme` reject a hand-written value in a component
 * — the actual cause of both regressions.
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
});
