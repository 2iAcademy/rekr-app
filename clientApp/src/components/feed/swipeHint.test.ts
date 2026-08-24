import { describe, expect, it } from 'vitest';
import { swipeDirection, swipeProgress } from './swipeHint';

describe('swipeDirection', () => {
  it('associe la droite au like et la gauche au rejet', () => {
    expect(swipeDirection(40)).toBe('like');
    expect(swipeDirection(-40)).toBe('pass');
  });

  it('n’annonce aucune intention à l’arrêt', () => {
    expect(swipeDirection(0)).toBeNull();
  });
});

describe('swipeProgress', () => {
  it('croît avec la distance parcourue', () => {
    expect(swipeProgress(0, 120)).toBe(0);
    expect(swipeProgress(60, 120)).toBe(0.5);
    expect(swipeProgress(-60, 120)).toBe(0.5);
  });

  it('plafonne à 1 une fois le seuil dépassé', () => {
    expect(swipeProgress(120, 120)).toBe(1);
    expect(swipeProgress(400, 120)).toBe(1);
  });
});
