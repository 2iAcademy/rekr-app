import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import {
  offerControllerFindFeed,
  offerControllerLike,
  type OfferFeedItemDto,
} from '@/api/generated';
import { anOffer, anotherOffer } from '../fixtures';
import { CandidateFeedPage } from './CandidateFeedPage';

vi.mock('@/api/generated', () => ({
  offerControllerFindFeed: vi.fn(),
  offerControllerLike: vi.fn(),
}));

const findFeed = vi.mocked(offerControllerFindFeed);
const like = vi.mocked(offerControllerLike);

const answer = (data: OfferFeedItemDto[]) =>
  ({ data, status: 200, headers: new Headers() }) as unknown as Awaited<
    ReturnType<typeof offerControllerFindFeed>
  >;

const renderPage = (onOpenOffer = vi.fn()) => {
  render(
    <MemoryRouter>
      <CandidateFeedPage onOpenOffer={onOpenOffer} />
    </MemoryRouter>,
  );

  return { onOpenOffer };
};

const heading = (name: string) => screen.getByRole('heading', { name });
const button = (name: string) => screen.getByRole('button', { name });

const dragCard = (distance: number) => {
  const card = screen.getByRole('article').parentElement;
  if (!card) {
    throw new Error('carte introuvable');
  }

  fireEvent.pointerDown(card, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: distance, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(window, { pointerId: 1 });
};

describe('CandidateFeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFeed.mockResolvedValue(answer([anOffer, anotherOffer]));
    like.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof offerControllerLike>>);
  });

  it('ouvre le deck sur la première offre servie par l’API', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Développeur Frontend React' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Offres' })).toBeInTheDocument();
  });

  /**
   * Aucun filtre n'est envoyé : le paquet est constitué côté serveur à partir
   * du profil. C'est toute la raison pour laquelle l'écran n'a plus de barre de
   * filtres.
   */
  it('ne demande aucun filtre à l’API', async () => {
    renderPage();

    await waitFor(() => expect(findFeed).toHaveBeenCalledTimes(1));
    const [query] = findFeed.mock.calls[0];
    expect(Object.keys(query ?? {})).toEqual(['limit']);
  });

  it('n’affiche plus de barre de filtres', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Développeur Frontend React' });
    expect(screen.queryByRole('group', { name: 'Type de contrat' })).not.toBeInTheDocument();
    expect(screen.queryByText(/offres correspondent/)).not.toBeInTheDocument();
  });

  it('avance dans le deck après un passage ou un like', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    expect(heading('Data Analyst')).toBeVisible();

    await user.click(button('Liker'));
    expect(heading('Tu as tout vu')).toBeVisible();
    expect(screen.getByText('1 offre likée')).toBeVisible();
  });

  // Le like est la seule décision persistée : rien ne stocke un passage.
  it('enregistre le like côté serveur, et seulement le like', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    expect(like).not.toHaveBeenCalled();

    await user.click(button('Liker'));

    await waitFor(() => expect(like).toHaveBeenCalledWith(anotherOffer.id));
    expect(like).toHaveBeenCalledTimes(1);
  });

  /**
   * La carte quitte le deck avant l'accord du serveur : un swipe qui attendrait
   * le réseau bloquerait le paquet. L'échec part en toast, et le like non écrit
   * revient au prochain chargement puisque le serveur ne l'exclura pas.
   */
  it('avance dans le deck même si l’enregistrement du like échoue', async () => {
    const user = userEvent.setup();
    like.mockRejectedValue(new Error('réseau'));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Liker' }));

    expect(heading('Data Analyst')).toBeVisible();
  });

  it('délègue l’ouverture de détail depuis la carte', async () => {
    const user = userEvent.setup();
    const { onOpenOffer } = renderPage();

    await user.click(
      await screen.findByRole('button', { name: "Voir l'offre Développeur Frontend React" }),
    );

    expect(onOpenOffer).toHaveBeenCalledWith(anOffer.id);
  });

  it('prend les mêmes décisions au clavier et au glissement', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'Développeur Frontend React' });
    dragCard(200);
    expect(heading('Data Analyst')).toBeVisible();

    await user.keyboard('{ArrowLeft}');
    expect(heading('Tu as tout vu')).toBeVisible();
  });

  it('propose de réessayer quand le chargement échoue', async () => {
    const user = userEvent.setup();
    findFeed.mockRejectedValueOnce(new Error('réseau'));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(findFeed).toHaveBeenCalledTimes(2));
  });

  /**
   * `queryByRole('heading')` ne verrait que le titre de `EmptyDeck` et
   * laisserait passer la région live, qui est justement l'endroit où la phrase
   * s'échappait. C'est le texte entier qui doit être absent.
   */
  it('n’annonce nulle part la fin du deck pendant le chargement', () => {
    renderPage();

    expect(screen.queryByText(/tu as tout vu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aucune offre ne correspond/i)).not.toBeInTheDocument();
  });

  // Deux messages contradictoires à la fois : un lecteur d'écran recevait
  // l'alerte d'échec ET l'annonce de fin de deck.
  it('n’annonce pas la fin du deck quand le chargement a échoué', async () => {
    findFeed.mockRejectedValueOnce(new Error('réseau'));
    renderPage();

    await screen.findByRole('alert');

    expect(screen.queryByText(/tu as tout vu/i)).not.toBeInTheDocument();
  });

  /**
   * « Tu as tout vu » est faux quand le deck arrive vide : le candidat n'a rien
   * vu, ses critères n'ont rien laissé passer. Le message doit le renvoyer à
   * son profil, pas le féliciter.
   */
  it('distingue un deck vide à l’arrivée d’un deck épuisé', async () => {
    findFeed.mockResolvedValue(answer([]));
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Aucune offre ne correspond à tes critères' }),
    ).toBeInTheDocument();
  });

  it('annonce la fin du deck une fois toutes les offres répondues', async () => {
    const user = userEvent.setup();
    findFeed.mockResolvedValue(answer([anOffer]));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Passer' }));

    expect(screen.getByRole('heading', { name: 'Tu as tout vu' })).toBeInTheDocument();
  });
});
