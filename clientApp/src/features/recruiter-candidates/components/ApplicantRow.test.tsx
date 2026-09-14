import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OfferApplicantDto } from '@/api/generated';
import { anApplicant } from '../fixtures';
import { ApplicantRow } from './ApplicantRow';

type Overrides = Partial<OfferApplicantDto> & { liked?: boolean; pending?: boolean };

const renderRow = ({ liked = false, pending = false, ...overrides }: Overrides = {}) => {
  const onOpen = vi.fn();
  const onLike = vi.fn();

  render(
    <ul>
      <ApplicantRow
        applicant={{ ...anApplicant, ...overrides }}
        liked={liked}
        pending={pending}
        onOpen={onOpen}
        onLike={onLike}
      />
    </ul>,
  );

  return { onOpen, onLike };
};

describe('ApplicantRow', () => {
  it('affiche le prénom, le poste recherché et le résumé', () => {
    renderRow();

    expect(screen.getByRole('button', { name: 'Voir le profil de Camille' })).toBeInTheDocument();
    expect(screen.getByText('Développeuse back-end')).toBeInTheDocument();
    expect(screen.getByText('Lyon · Confirmé · Immédiate')).toBeInTheDocument();
  });

  it('ouvre le profil depuis le prénom', async () => {
    const user = userEvent.setup();
    const { onOpen } = renderRow();

    await user.click(screen.getByRole('button', { name: 'Voir le profil de Camille' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('remonte le like', async () => {
    const user = userEvent.setup();
    const { onLike } = renderRow();

    await user.click(screen.getByRole('button', { name: 'Liker Camille' }));

    expect(onLike).toHaveBeenCalledTimes(1);
  });

  it('désactive le like une fois l’intérêt enregistré', () => {
    renderRow({ liked: true });

    expect(screen.getByRole('button', { name: 'Camille, intérêt enregistré' })).toBeDisabled();
  });

  it('désactive le like pendant l’envoi', () => {
    renderRow({ pending: true });

    expect(screen.getByRole('button', { name: 'Liker Camille' })).toBeDisabled();
  });

  // Rien ne doit apparaître à sa place : une ligne vide sous le prénom se lirait
  // comme une information manquante plutôt qu'absente.
  it('masque le poste recherché quand il n’est pas renseigné', () => {
    renderRow({ desiredJobTitle: null });

    expect(screen.queryByText('Développeuse back-end')).not.toBeInTheDocument();
  });
});
