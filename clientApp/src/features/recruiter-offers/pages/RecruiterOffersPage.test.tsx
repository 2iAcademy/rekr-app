import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiError } from '@/api/customFetch';
import {
  offerControllerFindMine,
  offerControllerUpdate,
  type OfferListItemDto,
} from '@/api/generated';
import { Toaster } from '@/components/ui/sonner';
import { OFFERS_PAGE_SIZE } from '../useOffers';
import { RecruiterOffersPage } from './RecruiterOffersPage';

vi.mock('@/api/generated', () => ({
  offerControllerFindMine: vi.fn(),
  offerControllerUpdate: vi.fn(),
}));

const findMine = vi.mocked(offerControllerFindMine);
const update = vi.mocked(offerControllerUpdate);

const answer = (data: unknown) =>
  ({ data, status: 200, headers: new Headers() }) as unknown as Awaited<
    ReturnType<typeof offerControllerFindMine>
  >;

const apiError = (status: number, message: string) =>
  new ApiError({ status, statusText: '', url: '/api/offers', data: { message } });

const offer = (over: Partial<OfferListItemDto> = {}): OfferListItemDto => ({
  id: 12,
  title: 'Développeuse backend',
  status: 'draft',
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
  ...over,
});

const manyOffers = (count: number): OfferListItemDto[] =>
  Array.from({ length: count }, (_, index) =>
    offer({ id: index + 1, title: `Offre ${index + 1}` }),
  );

const updatedTo = (status: OfferListItemDto['status']) =>
  answer({ ...offer(), companyId: 7, status }) as unknown as Awaited<
    ReturnType<typeof offerControllerUpdate>
  >;

const renderPage = () =>
  render(
    <MemoryRouter>
      <RecruiterOffersPage />
      <Toaster />
    </MemoryRouter>,
  );

const renderLoaded = async () => {
  const rendered = renderPage();
  await screen.findByRole('heading', { name: 'Développeuse backend' });

  return rendered;
};

const statusSelect = () =>
  screen.getByRole('combobox', { name: 'Statut de l’offre Développeuse backend' });

describe('RecruiterOffersPage', () => {
  beforeEach(() => {
    // `restoreMocks` only covers spies; the `vi.fn()`s of the module factory are
    // created once and would carry their calls across tests.
    findMine.mockReset();
    update.mockReset();
    findMine.mockResolvedValue(answer([offer()]));
  });

  it('annonce le chargement avant d’afficher les offres', async () => {
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de vos offres');

    expect(await screen.findByRole('heading', { name: 'Développeuse backend' })).toBeVisible();
  });

  it('liste les offres de la société', async () => {
    findMine.mockResolvedValue(
      answer([offer(), offer({ id: 13, title: 'Designer produit', status: 'open' })]),
    );
    await renderLoaded();

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Designer produit' })).toBeInTheDocument();
  });

  it('avertit que la liste est tronquée quand la société a plus d’offres qu’une page', async () => {
    findMine.mockResolvedValue(answer(manyOffers(OFFERS_PAGE_SIZE + 1)));
    renderPage();

    expect(await screen.findByRole('note')).toHaveTextContent(
      `Seules les ${OFFERS_PAGE_SIZE} offres les plus récentes sont affichées`,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(OFFERS_PAGE_SIZE);
  });

  it('n’avertit de rien quand la page affichée contient toutes les offres', async () => {
    findMine.mockResolvedValue(answer(manyOffers(OFFERS_PAGE_SIZE)));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Offre 1' })).toBeVisible();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('propose de recharger quand le chargement échoue, sans exposer l’erreur technique', async () => {
    const user = userEvent.setup();
    findMine.mockRejectedValueOnce(apiError(500, 'Internal server error'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger vos offres.');
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { name: 'Développeuse backend' })).toBeVisible();
  });

  it('invite à créer une première offre quand la société n’en a aucune', async () => {
    findMine.mockResolvedValue(answer([]));
    renderPage();

    expect(await screen.findByText('Vous n’avez pas encore publié d’offre.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Créer ma première offre' })).toHaveAttribute(
      'href',
      '/recruteur/offres/nouvelle',
    );
  });

  it('donne en permanence un accès à la création d’une offre', async () => {
    await renderLoaded();

    expect(screen.getByRole('link', { name: 'Créer une offre' })).toHaveAttribute(
      'href',
      '/recruteur/offres/nouvelle',
    );
  });

  it('demande au backend les seules offres du statut filtré', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filtrer par statut' }),
      'paused',
    );

    await waitFor(() =>
      expect(findMine).toHaveBeenLastCalledWith({
        limit: OFFERS_PAGE_SIZE + 1,
        status: 'paused',
      }),
    );
  });

  it('explique une liste vide due au filtre plutôt que de la confondre avec une absence d’offre', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    findMine.mockResolvedValue(answer([]));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filtrer par statut' }),
      'filled',
    );

    expect(await screen.findByText('Aucune offre avec ce statut.')).toBeVisible();
    expect(screen.queryByText('Vous n’avez pas encore publié d’offre.')).not.toBeInTheDocument();
  });

  it('confirme le changement de statut et repeint le badge', async () => {
    const user = userEvent.setup();
    update.mockResolvedValueOnce(updatedTo('open'));
    await renderLoaded();

    await user.selectOptions(statusSelect(), 'open');

    expect(await screen.findByText('Statut de l’offre mis à jour.')).toBeVisible();
    expect(update).toHaveBeenCalledWith(12, { status: 'open' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Publiée'));
  });

  it('garde le statut d’origine et prévient quand l’enregistrement échoue', async () => {
    const user = userEvent.setup();
    update.mockRejectedValueOnce(apiError(500, 'Internal server error'));
    await renderLoaded();

    await user.selectOptions(statusSelect(), 'closed');

    expect(
      await screen.findByText('Une erreur est survenue. Réessayez dans un instant.'),
    ).toBeVisible();
    expect(statusSelect()).toHaveValue('draft');
  });

  it('avertit que l’offre a disparu quand le backend répond 404', async () => {
    const user = userEvent.setup();
    update.mockRejectedValueOnce(apiError(404, 'Offer not found'));
    await renderLoaded();

    await user.selectOptions(statusSelect(), 'closed');

    expect(await screen.findByText('Cette offre n’existe plus.')).toBeVisible();
  });
});
