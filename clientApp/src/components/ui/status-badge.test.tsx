import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  OFFER_STATUSES,
  offerStatusLabel,
  offerStatusTone,
  type OfferStatus,
  type OfferStatusTone,
} from '@/domain/offerStatus';
import { StatusBadge } from './status-badge';

const renderBadge = (status: OfferStatus) => {
  const { unmount } = render(<StatusBadge status={status} />);
  const { className } = screen.getByRole('status');

  unmount();

  return className;
};

describe('StatusBadge', () => {
  it.each(OFFER_STATUSES)('affiche le libellé du statut « %s »', (status) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByRole('status')).toHaveTextContent(offerStatusLabel(status));
  });

  // Read on its own, « Fermée » says nothing about what is closed. The
  // accessible name carries the subject so the badge stays intelligible when it
  // is announced away from the row it sits in.
  it('annonce le statut avec son sujet', () => {
    render(<StatusBadge status="open" />);

    expect(screen.getByRole('status', { name: 'Statut : Publiée' })).toBeInTheDocument();
  });

  it('donne une allure distincte à chaque tonalité', () => {
    const classNamesByTone = new Map<OfferStatusTone, string>(
      OFFER_STATUSES.map((status) => [offerStatusTone(status), renderBadge(status)]),
    );

    expect(new Set(classNamesByTone.values()).size).toBe(classNamesByTone.size);
  });

  // `filled` and `closed` share the muted tone by decision: what tells them
  // apart is the wording, not the colour.
  it('éteint de la même façon les deux statuts de fin de vie', () => {
    expect(renderBadge('filled')).toBe(renderBadge('closed'));
  });

  // The recruiter palette redefines `--line`, so a badge painted with raw
  // colours would drift out of the theme. Nothing here may be hard-coded.
  it('ne peint aucune couleur hors des tokens du design system', () => {
    for (const status of OFFER_STATUSES) {
      expect(renderBadge(status)).not.toMatch(/#[0-9a-f]{3}|rgb\(|hsl\(|oklch\(/i);
    }
  });

  it('accepte une classe de mise en page du parent sans perdre la sienne', () => {
    render(<StatusBadge status="draft" className="self-start" />);
    const badge = screen.getByRole('status');

    expect(badge).toHaveClass('self-start');
    expect(badge.className.split(' ').length).toBeGreaterThan(1);
  });
});
