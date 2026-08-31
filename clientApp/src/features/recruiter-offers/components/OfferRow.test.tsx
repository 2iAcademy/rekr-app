import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { OfferListItemDto } from '@/api/generated';
import { OfferRow } from './OfferRow';

const offer: OfferListItemDto = {
  id: 12,
  title: 'Développeuse backend',
  status: 'open',
  city: 'Lyon',
  postalCode: '69003',
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
  salaryMin: 45000,
  salaryMax: 55000,
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  applicantCount: 0,
};

const renderRow = (over: Partial<OfferListItemDto> = {}, pending = false) => {
  const onStatusChange = vi.fn();
  render(
    <MemoryRouter>
      <ul>
        <OfferRow
          offer={{ ...offer, ...over }}
          statusPending={pending}
          onStatusChange={onStatusChange}
        />
      </ul>
    </MemoryRouter>,
  );

  return { onStatusChange };
};

describe('OfferRow', () => {
  /**
   * Un lien nommé par son contenu, et visible sans survol : c'est ce que le
   * recruteur vient chercher dans cette liste, et un lien qui n'apparaît qu'au
   * survol du titre est inatteignable sur un écran tactile.
   */
  it('mène aux candidats intéressés depuis un lien nommé', () => {
    renderRow({ applicantCount: 3 });

    expect(screen.getByRole('link', { name: /3 candidats intéressés/ })).toHaveAttribute(
      'href',
      '/recruteur/offres/12/candidats',
    );
  });

  it('accorde le libellé au singulier', () => {
    renderRow({ applicantCount: 1 });

    expect(screen.getByRole('link', { name: /1 candidat intéressé/ })).toBeInTheDocument();
  });

  /**
   * Affiché même à zéro : masqué, plus rien sur la ligne ne disait que l'offre
   * menait quelque part, et un recruteur dont aucune offre n'a encore de
   * candidat ne pouvait pas découvrir l'écran.
   */
  it('reste accessible quand personne n’a encore manifesté d’intérêt', () => {
    renderRow({ applicantCount: 0 });

    expect(screen.getByRole('link', { name: /Aucun candidat intéressé/ })).toHaveAttribute(
      'href',
      '/recruteur/offres/12/candidats',
    );
  });

  it('ne fait plus du titre un lien, pour ne pas doubler la même cible', () => {
    renderRow();

    expect(screen.queryByRole('link', { name: 'Développeuse backend' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Développeuse backend' })).toBeInTheDocument();
  });

  it('affiche le titre, le statut et la ligne de contexte de l’offre', () => {
    renderRow();

    expect(screen.getByRole('heading', { name: 'Développeuse backend' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Publiée');
    expect(screen.getByText('Lyon · CDI')).toBeInTheDocument();
    expect(screen.getByText('45 - 55 k€')).toBeInTheDocument();
  });

  /** Every field but the title is nullable in the list payload: the row must
   * hold together on an offer that was barely started. */
  it('se contente de ce qui est renseigné quand ville, contrat et salaire manquent', () => {
    renderRow({ city: null, contractType: null, salaryMin: null, salaryMax: null });

    expect(screen.getByRole('heading', { name: 'Développeuse backend' })).toBeInTheDocument();
    expect(screen.getByText('Salaire non communiqué')).toBeInTheDocument();
  });

  it('renvoie vers l’édition de cette offre', () => {
    renderRow();

    expect(
      screen.getByRole('link', { name: 'Modifier l’offre Développeuse backend' }),
    ).toHaveAttribute('href', '/recruteur/offres/12/edition');
  });

  it('remonte le statut choisi sans le peindre lui-même', async () => {
    const user = userEvent.setup();
    const { onStatusChange } = renderRow();

    await user.selectOptions(screen.getByRole('combobox'), 'paused');

    expect(onStatusChange).toHaveBeenCalledWith('paused');
    expect(screen.getByRole('status')).toHaveTextContent('Publiée');
  });

  it('gèle le sélecteur pendant l’enregistrement', () => {
    renderRow({}, true);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
