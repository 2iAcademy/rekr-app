import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/api/customFetch';
import {
  offerControllerFindMine,
  offerControllerUpdate,
  type OfferDto,
  type OfferListItemDto,
} from '@/api/generated';
import { OFFERS_PAGE_SIZE, useOffers } from './useOffers';

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
  id: 1,
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
  ...over,
});

const updated = (over: Partial<OfferDto>) =>
  answer({
    id: 1,
    companyId: 7,
    createdById: 3,
    title: 'Développeuse backend',
    description: null,
    city: 'Lyon',
    postalCode: '69003',
    latitude: null,
    longitude: null,
    contractType: 'CDI',
    minExperienceLevel: 'CONFIRME',
    remotePolicy: 'HYBRID',
    salaryMin: 45000,
    salaryMax: 55000,
    status: 'open',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-02T00:00:00.000Z',
    ...over,
  }) as unknown as Awaited<ReturnType<typeof offerControllerUpdate>>;

const offers = (count: number): OfferListItemDto[] =>
  Array.from({ length: count }, (_, index) => offer({ id: index + 1 }));

const loaded = async () => {
  const rendered = renderHook(() => useOffers());
  await waitFor(() => expect(rendered.result.current.status).toBe('ready'));

  return rendered;
};

describe('useOffers', () => {
  beforeEach(() => {
    // `restoreMocks` only covers spies; the `vi.fn()`s of the module factory are
    // created once and would carry their calls across tests.
    findMine.mockReset();
    update.mockReset();
    findMine.mockResolvedValue(answer([offer()]));
  });

  it('charge les offres de la société sans filtre de statut', async () => {
    const { result } = await loaded();

    expect(findMine).toHaveBeenCalledWith({ limit: OFFERS_PAGE_SIZE + 1 });
    expect(result.current.offers).toHaveLength(1);
    expect(result.current.statusFilter).toBe('all');
    expect(result.current.truncated).toBe(false);
  });

  it('signale la troncature et n’affiche pas l’offre sentinelle quand il en reste au-delà de la page', async () => {
    findMine.mockResolvedValue(answer(offers(OFFERS_PAGE_SIZE + 1)));
    const { result } = await loaded();

    expect(result.current.truncated).toBe(true);
    expect(result.current.offers).toHaveLength(OFFERS_PAGE_SIZE);
    expect(result.current.offers.map(({ id }) => id)).not.toContain(OFFERS_PAGE_SIZE + 1);
  });

  it('ne signale aucune troncature quand la société a exactement une page d’offres', async () => {
    findMine.mockResolvedValue(answer(offers(OFFERS_PAGE_SIZE)));
    const { result } = await loaded();

    expect(result.current.truncated).toBe(false);
    expect(result.current.offers).toHaveLength(OFFERS_PAGE_SIZE);
  });

  it('recalcule la troncature quand le filtre de statut ramène la liste sous la page', async () => {
    findMine.mockResolvedValueOnce(answer(offers(OFFERS_PAGE_SIZE + 1)));
    const { result } = await loaded();

    expect(result.current.truncated).toBe(true);

    findMine.mockResolvedValue(answer(offers(2)));
    act(() => result.current.setStatusFilter('open'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.truncated).toBe(false);
  });

  it('expose l’échec du chargement et le rejoue à la demande', async () => {
    findMine.mockRejectedValueOnce(apiError(500, 'Internal server error'));
    const { result } = renderHook(() => useOffers());

    await waitFor(() => expect(result.current.status).toBe('failed'));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.offers).toHaveLength(1);
  });

  it('délègue le filtrage par statut au backend', async () => {
    const { result } = await loaded();

    act(() => result.current.setStatusFilter('open'));

    await waitFor(() => expect(result.current.statusFilter).toBe('open'));
    expect(findMine).toHaveBeenLastCalledWith({ limit: OFFERS_PAGE_SIZE + 1, status: 'open' });
  });

  it('ne recharge pas quand le filtre choisi est déjà actif', async () => {
    const { result } = await loaded();

    act(() => result.current.setStatusFilter('all'));

    expect(findMine).toHaveBeenCalledTimes(1);
  });

  it('adopte le statut confirmé par le serveur, sans recharger la liste', async () => {
    update.mockResolvedValueOnce(updated({ status: 'open' }));
    const { result } = await loaded();

    await act(() => result.current.updateStatus(1, 'open'));

    expect(update).toHaveBeenCalledWith(1, { status: 'open' });
    expect(result.current.offers[0].status).toBe('open');
    expect(findMine).toHaveBeenCalledTimes(1);
  });

  it('laisse l’offre sur son statut d’origine quand la mutation échoue', async () => {
    update.mockRejectedValueOnce(apiError(404, 'Offer not found'));
    const { result } = await loaded();

    await expect(act(() => result.current.updateStatus(1, 'closed'))).rejects.toBeInstanceOf(
      ApiError,
    );

    expect(result.current.offers[0].status).toBe('draft');
    expect(result.current.pendingId).toBeNull();
  });

  it('signale l’offre en cours de mutation le temps de l’aller-retour', async () => {
    let settle!: (value: Awaited<ReturnType<typeof offerControllerUpdate>>) => void;
    update.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    const { result } = await loaded();

    let mutation!: Promise<void>;
    act(() => {
      mutation = result.current.updateStatus(1, 'paused');
    });

    await waitFor(() => expect(result.current.pendingId).toBe(1));

    await act(async () => {
      settle(updated({ status: 'paused' }));
      await mutation;
    });

    expect(result.current.pendingId).toBeNull();
  });

  it('retire de la liste l’offre qui ne satisfait plus le filtre actif', async () => {
    findMine.mockResolvedValue(answer([offer({ id: 1, status: 'open' }), offer({ id: 2 })]));
    update.mockResolvedValueOnce(updated({ status: 'closed' }));
    const { result } = await loaded();

    act(() => result.current.setStatusFilter('open'));
    await waitFor(() => expect(result.current.statusFilter).toBe('open'));

    await act(() => result.current.updateStatus(1, 'closed'));

    expect(result.current.offers.map(({ id }) => id)).not.toContain(1);
  });
});
