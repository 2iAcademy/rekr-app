import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfferDetailPage } from './OfferDetailPage';
import { mockOffer } from '@/features/offers/data/mock-offer';

describe('OfferDetailPage', () => {
  it("affiche le titre de l'offre", () => {
    render(<OfferDetailPage />);

    expect(screen.getByRole('heading', { level: 2, name: mockOffer.title })).toBeInTheDocument();
  });

  it("affiche le nom de l'entreprise, taille et localisation", () => {
    render(<OfferDetailPage />);

    expect(
      screen.getByText(`${mockOffer.company} · ${mockOffer.companySize} · ${mockOffer.location}`),
    ).toBeInTheDocument();
  });

  it('affiche le salaire en gras', () => {
    render(<OfferDetailPage />);

    expect(screen.getByText(mockOffer.salary)).toBeInTheDocument();
  });

  it('affiche la stack technique', () => {
    render(<OfferDetailPage />);

    for (const tech of mockOffer.stack) {
      expect(screen.getByText(tech)).toBeInTheDocument();
    }
  });

  it('affiche les en-têtes de sections en majuscules', () => {
    render(<OfferDetailPage />);

    expect(screen.getByText('Stack technique')).toBeInTheDocument();
    expect(screen.getByText('Salaire')).toBeInTheDocument();
    expect(screen.getByText('À propos du poste')).toBeInTheDocument();
    expect(screen.getByText("À propos de l'entreprise")).toBeInTheDocument();
  });

  it('affiche la section À propos du poste', () => {
    render(<OfferDetailPage />);

    expect(screen.getByText(mockOffer.aboutRole)).toBeInTheDocument();
  });

  it("affiche la section À propos de l'entreprise", () => {
    render(<OfferDetailPage />);

    expect(screen.getByText(mockOffer.aboutCompany)).toBeInTheDocument();
  });

  it("affiche les boutons Passer et Liker", () => {
    render(<OfferDetailPage />);

    expect(screen.getByRole('button', { name: 'Passer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Liker' })).toBeInTheDocument();
  });

  it('déclenche onPass au clic sur Passer', async () => {
    const user = userEvent.setup();
    const onPass = vi.fn();
    render(<OfferDetailPage onPass={onPass} />);

    await user.click(screen.getByRole('button', { name: 'Passer' }));

    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('déclenche onLike au clic sur Liker', async () => {
    const user = userEvent.setup();
    const onLike = vi.fn();
    render(<OfferDetailPage onLike={onLike} />);

    await user.click(screen.getByRole('button', { name: 'Liker' }));

    expect(onLike).toHaveBeenCalledTimes(1);
  });

  it('déclenche onBack au clic sur le bouton fermer', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<OfferDetailPage onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
