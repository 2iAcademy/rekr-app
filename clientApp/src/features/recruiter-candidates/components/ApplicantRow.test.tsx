import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OfferApplicantDto } from '@/api/generated';
import { anApplicant } from '../fixtures';
import type { ApplicantDecision } from '../useApplicants';
import { ApplicantRow } from './ApplicantRow';

type Overrides = Partial<OfferApplicantDto> & {
  decision?: ApplicantDecision;
  pending?: boolean;
};

const renderRow = ({ decision = null, pending = false, ...overrides }: Overrides = {}) => {
  const onOpen = vi.fn();
  const onLike = vi.fn();
  const onPass = vi.fn();

  render(
    <ul>
      <ApplicantRow
        applicant={{ ...anApplicant, ...overrides }}
        decision={decision}
        pending={pending}
        onOpen={onOpen}
        onLike={onLike}
        onPass={onPass}
      />
    </ul>,
  );

  return { onOpen, onLike, onPass };
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

  it('remonte le like et le passage', async () => {
    const user = userEvent.setup();
    const { onLike, onPass } = renderRow();
    await user.click(screen.getByRole('button', { name: 'Liker Camille' }));
    await user.click(screen.getByRole('button', { name: 'Passer Camille' }));
    expect(onLike).toHaveBeenCalledTimes(1);
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('affiche la décision sauvegardée et désactive les deux actions', () => {
    renderRow({ decision: { kind: 'liked', at: '2026-09-16T09:30:00.000Z' } });
    expect(screen.getByRole('status')).toHaveTextContent('Intérêt déjà enregistré');
    const actions = screen.getAllByRole('button', { name: /Camille, Intérêt déjà enregistré/ });
    expect(actions).toHaveLength(2);
    actions.forEach((button) => expect(button).toBeDisabled());
  });

  it('affiche un passage sauvegardé et désactive les deux actions', () => {
    renderRow({ decision: { kind: 'passed', at: '2026-09-16T09:30:00.000Z' } });
    expect(screen.getByRole('status')).toHaveTextContent('Candidat déjà passé');
    expect(screen.getAllByRole('button', { name: /Camille, Candidat déjà passé/ })).toHaveLength(2);
    screen
      .getAllByRole('button', { name: /Camille, Candidat déjà passé/ })
      .forEach((button) => expect(button).toBeDisabled());
  });

  it('désactive les deux actions pendant l’envoi', () => {
    renderRow({ pending: true });
    expect(screen.getByRole('button', { name: 'Liker Camille' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Passer Camille' })).toBeDisabled();
  });

  it('masque le poste recherché quand il n’est pas renseigné', () => {
    renderRow({ desiredJobTitle: null });
    expect(screen.queryByText('Développeuse back-end')).not.toBeInTheDocument();
  });
});
