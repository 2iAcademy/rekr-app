import { describe, expect, it } from 'vitest';
import {
  emptyReason,
  likedCount,
  noDecisions,
  recordDecision,
  remainingItems,
  type DeckDecisions,
} from './deck';

/**
 * The state machine of the swipe deck, driven today by the candidate feed. It
 * was only ever tested through the retired recruiter deck, so these cases were
 * lost with it — and nothing in CI noticed, the module having no threshold of
 * its own.
 */
const item = (id: number) => ({ id });
const deck = [item(1), item(2), item(3)];
const always = () => true;

describe('recordDecision', () => {
  it('inscrit la décision prise sur une carte', () => {
    expect(recordDecision(noDecisions, 1, 'liked')).toEqual({ 1: 'liked' });
  });

  // L'état est partagé par toute l'application : une mutation en place
  // corromprait le point de départ de tous les decks.
  it('ne touche pas à l’état reçu', () => {
    recordDecision(noDecisions, 1, 'liked');

    expect(noDecisions).toEqual({});
  });

  it('écrase une décision déjà prise sur la même carte', () => {
    const decisions = recordDecision(noDecisions, 1, 'passed');

    expect(recordDecision(decisions, 1, 'liked')).toEqual({ 1: 'liked' });
  });
});

describe('remainingItems', () => {
  it('écarte les cartes déjà répondues', () => {
    const decisions = recordDecision(noDecisions, 2, 'liked');

    expect(remainingItems(deck, decisions, always)).toEqual([item(1), item(3)]);
  });

  it('applique aussi le filtre du deck', () => {
    expect(remainingItems(deck, noDecisions, ({ id }) => id !== 2)).toEqual([item(1), item(3)]);
  });

  it('conserve l’ordre du paquet', () => {
    expect(remainingItems(deck, noDecisions, always)).toEqual(deck);
  });
});

describe('likedCount', () => {
  it('ne compte que les likes', () => {
    const decisions: DeckDecisions = { 1: 'liked', 2: 'passed', 3: 'liked' };

    expect(likedCount(decisions)).toBe(2);
  });

  it('compte zéro sur un deck intact', () => {
    expect(likedCount(noDecisions)).toBe(0);
  });
});

describe('emptyReason', () => {
  it('dit « épuisé » quand toutes les cartes ont été répondues', () => {
    const decisions: DeckDecisions = { 1: 'liked', 2: 'passed', 3: 'liked' };

    expect(emptyReason(deck, decisions)).toBe('exhausted');
  });

  it('dit « aucun résultat » quand il reste des cartes non répondues', () => {
    expect(emptyReason(deck, recordDecision(noDecisions, 1, 'liked'))).toBe('no-match');
  });

  /**
   * Les deux causes se recouvrent ici, et « épuisé » l'emporte : un paquet vide
   * n'est pas un filtre trop serré, et proposer de réinitialiser des filtres
   * n'y changerait rien.
   */
  it('tranche pour « épuisé » sur un paquet vide', () => {
    expect(emptyReason([], noDecisions)).toBe('exhausted');
  });
});
