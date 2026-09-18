import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiError } from '@/api/customFetch';
import {
  offerControllerFindApplicants,
  offerControllerLikeApplicant,
  type OfferApplicantDto,
} from '@/api/generated';
import { anApplicant } from '../fixtures';
import { OfferApplicantsPage } from './OfferApplicantsPage';

vi.mock('@/api/generated', () => ({
  offerControllerFindApplicants: vi.fn(),
  offerControllerLikeApplicant: vi.fn(),
}));

const findApplicants = vi.mocked(offerControllerFindApplicants);
const likeApplicant = vi.mocked(offerControllerLikeApplicant);

const answer = (data: OfferApplicantDto[]) =>
  ({ data, status: 200, headers: new Headers() }) as unknown as Awaited<
    ReturnType<typeof offerControllerFindApplicants>
  >;

const applicant = (over: Partial<OfferApplicantDto> = {}): OfferApplicantDto => ({
  ...anApplicant,
  ...over,
});

const renderPage = (openApplicantId: number | null = null) => {
  const onOpenProfile = vi.fn();
  const onCloseProfile = vi.fn();

  render(
    <MemoryRouter>
      <OfferApplicantsPage
        offerId={12}
        openApplicantId={openApplicantId}
        onOpenProfile={onOpenProfile}
        onCloseProfile={onCloseProfile}
      />
    </MemoryRouter>,
  );

  return { onOpenProfile, onCloseProfile };
};

const rows = () =>
  within(screen.getByRole('list', { name: 'Candidats intéressés par cette offre' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('OfferApplicantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findApplicants.mockResolvedValue(answer([applicant()]));
    likeApplicant.mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof offerControllerLikeApplicant>>,
    );
  });

  it('demande les candidats de l’offre affichée', async () => {
    renderPage();

    await waitFor(() =>
      expect(findApplicants).toHaveBeenCalledWith(12, expect.objectContaining({ page: 1 })),
    );
  });

  it('liste les candidats intéressés', async () => {
    findApplicants.mockResolvedValue(
      answer([
        applicant({ userId: 1, firstName: 'Camille' }),
        applicant({ userId: 2, firstName: 'Yanis' }),
      ]),
    );

    renderPage();

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Voir le profil de Yanis' })).toBeInTheDocument();
  });

  // Ni un échec ni une invitation à agir : l'offre est publiée, il n'y a qu'à
  // attendre.
  it('annonce une liste vide sans la présenter comme une erreur', async () => {
    findApplicants.mockResolvedValue(answer([]));

    renderPage();

    expect(
      await screen.findByText('Personne n’a encore manifesté d’intérêt pour cette offre.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('distingue une offre introuvable d’une panne', async () => {
    findApplicants.mockRejectedValue(
      new ApiError({ status: 404, statusText: '', url: '/api/offers/12/likes', data: {} }),
    );

    renderPage();

    expect(await screen.findByText(/Cette offre est introuvable/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('propose de réessayer après un échec de chargement', async () => {
    const user = userEvent.setup();
    findApplicants.mockRejectedValueOnce(new Error('réseau'));

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(findApplicants).toHaveBeenCalledTimes(2));
  });

  it('enregistre l’intérêt du recruteur pour un candidat', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Liker Camille' }));

    await waitFor(() => expect(likeApplicant).toHaveBeenCalledWith(12, 1));
    expect(
      await screen.findByRole('button', { name: 'Camille, intérêt enregistré' }),
    ).toBeDisabled();
  });

  it('ouvre le profil d’un candidat', async () => {
    const user = userEvent.setup();
    const { onOpenProfile } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Voir le profil de Camille' }));

    expect(onOpenProfile).toHaveBeenCalledWith(1);
  });

  it('affiche le profil demandé par l’URL à la place de la liste', async () => {
    renderPage(1);

    expect(await screen.findByRole('region', { name: 'Profil de Camille' })).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Candidats intéressés par cette offre' }),
    ).not.toBeInTheDocument();
  });

  // Le candidat a pu être retiré de la liste, ou l'adresse simplement tapée :
  // mieux vaut la liste qu'un écran vide.
  it('retombe sur la liste quand l’URL nomme un candidat absent', async () => {
    renderPage(999);

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryByRole('region', { name: /Profil de/ })).not.toBeInTheDocument();
  });
});
