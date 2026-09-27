import { describe, expect, it } from 'vitest';
import { choosePrimaryJobFamily, toggleJobFamily } from './jobFamilySelection';

// The reference list as the chips show it: Commerce, Informatique, Restauration, Santé.
const REFERENCE = ['4', '13', '7', '9'];

describe('toggleJobFamily', () => {
  it('fait du premier métier coché le principal', () => {
    expect(toggleJobFamily([], '13', REFERENCE)).toEqual(['13']);
  });

  // Checking a second trade must not demote the one already chosen as primary,
  // even when it comes first in the reference list.
  it('garde le principal en tête quand on ajoute un secondaire', () => {
    expect(toggleJobFamily(['13'], '4', REFERENCE)).toEqual(['13', '4']);
  });

  it('range les secondaires dans l’ordre de la liste affichée', () => {
    expect(toggleJobFamily(['13', '9'], '4', REFERENCE)).toEqual(['13', '4', '9']);
  });

  it('retire un secondaire sans toucher au principal', () => {
    expect(toggleJobFamily(['13', '4', '9'], '4', REFERENCE)).toEqual(['13', '9']);
  });

  it('promeut le secondaire suivant quand on retire le principal', () => {
    expect(toggleJobFamily(['13', '4', '9'], '13', REFERENCE)).toEqual(['4', '9']);
  });

  it('refuse un quatrième métier', () => {
    expect(toggleJobFamily(['13', '4', '9'], '7', REFERENCE)).toEqual(['13', '4', '9']);
  });

  it('autorise à tout décocher', () => {
    expect(toggleJobFamily(['13'], '13', REFERENCE)).toEqual([]);
  });
});

describe('choosePrimaryJobFamily', () => {
  it('place le métier choisi en tête', () => {
    expect(choosePrimaryJobFamily(['13', '4', '9'], '9', REFERENCE)).toEqual(['9', '4', '13']);
  });

  it('laisse la sélection telle quelle si le métier est déjà principal', () => {
    expect(choosePrimaryJobFamily(['13', '4'], '13', REFERENCE)).toEqual(['13', '4']);
  });

  // A primary outside the selection would be sent to the API as a trade the
  // candidate never ticked.
  it('ignore un métier qui n’est pas coché', () => {
    expect(choosePrimaryJobFamily(['13', '4'], '7', REFERENCE)).toEqual(['13', '4']);
  });
});
