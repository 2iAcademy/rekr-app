import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SwipeHint } from './SwipeHint';

const THRESHOLD = 120;

/**
 * The hint is `aria-hidden` by design — the deck's live region is what speaks to
 * assistive tech — so it carries no role to query it by. Walking the two layers
 * by position is the only way to assert a component whose whole job is to be
 * seen and not heard.
 */
const renderHint = (offset: number) => {
  const { container } = render(<SwipeHint offset={offset} threshold={THRESHOLD} />);
  const root = container.firstElementChild;

  return {
    root,
    wash: root?.children[0],
    badge: root?.children[1],
  };
};

describe('SwipeHint', () => {
  it('reste invisible tant que la carte n’a pas bougé', () => {
    expect(renderHint(0).root).toBeNull();
  });

  it('lave la carte en couleur de marque quand elle part vers le like', () => {
    const { wash } = renderHint(60);

    expect(wash).toHaveClass('bg-brand');
    expect(wash).not.toHaveClass('bg-destructive');
  });

  it('lave la carte en rouge quand elle part vers le rejet', () => {
    const { wash } = renderHint(-60);

    expect(wash).toHaveClass('bg-destructive');
    expect(wash).not.toHaveClass('bg-brand');
  });

  it('distingue le cœur du like de la croix du rejet', () => {
    expect(renderHint(60).badge?.querySelector('.fill-brand')).not.toBeNull();
    expect(renderHint(-60).badge?.querySelector('.text-destructive')).not.toBeNull();
  });

  it('fait monter l’indice avec la distance parcourue', () => {
    expect(renderHint(60).badge).toHaveStyle({ opacity: '0.5' });
    expect(renderHint(THRESHOLD).badge).toHaveStyle({ opacity: '1' });
  });

  // The wash stays translucent past the threshold: the card underneath has to
  // remain readable, the recruiter is still deciding.
  it('garde le lavis translucide même au-delà du seuil', () => {
    expect(renderHint(400).wash).toHaveStyle({ opacity: '0.5' });
  });

  it('reste décoratif pour les technologies d’assistance', () => {
    expect(renderHint(60).root).toHaveAttribute('aria-hidden', 'true');
  });
});
