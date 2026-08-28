import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { offerControllerLike } from '@/api/generated';
import { mockFeedOffers } from '../mocks';
import { CandidateFeedPage } from './CandidateFeedPage';

vi.mock('@/api/generated', () => ({ offerControllerLike: vi.fn() }));

const like = vi.mocked(offerControllerLike);

const deck = (...ids: number[]) => mockFeedOffers.filter(({ id }) => ids.includes(id));

function FeedHarness({ offers = mockFeedOffers, onOpenOffer = vi.fn() }) {
  const [openedOffer, setOpenedOffer] = useState<number | null>(null);

  return (
    <>
      <CandidateFeedPage
        offers={offers}
        onOpenOffer={(id) => {
          setOpenedOffer(id);
          onOpenOffer(id);
        }}
      />
      <output>{openedOffer}</output>
    </>
  );
}

const renderPage = (offers = mockFeedOffers, onOpenOffer = vi.fn()) =>
  render(<FeedHarness offers={offers} onOpenOffer={onOpenOffer} />);

const heading = (name: string) => screen.getByRole('heading', { name });
const button = (name: string) => screen.getByRole('button', { name });

const dragCard = (distance: number) => {
  const card = screen.getByRole('article').parentElement;
  if (!card) {
    throw new Error('la carte doit être enveloppée par la zone de glissement');
  }

  fireEvent.pointerDown(card, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
  fireEvent.pointerMove(window, { clientX: distance, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(window, { pointerId: 1 });
};

describe('CandidateFeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    like.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof offerControllerLike>>);
  });

  it('ouvre le deck mocké sur la première offre', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Offres' })).toBeInTheDocument();
    expect(heading('Développeur Frontend React')).toBeVisible();
    expect(screen.getByText('8 offres correspondent')).toBeInTheDocument();
  });

  it('avance dans le deck après un passage ou un like', async () => {
    const user = userEvent.setup();
    renderPage(deck(101, 102));

    await user.click(button('Passer'));
    expect(heading('Data Analyst')).toBeVisible();

    await user.click(button('Liker'));
    expect(heading('Tu as tout vu')).toBeVisible();
    expect(screen.getByText('1 offre likée')).toBeVisible();
  });

  // Le like est la seule décision persistée : rien ne stocke un passage dans ce
  // périmètre.
  it('enregistre le like côté serveur, et seulement le like', async () => {
    const user = userEvent.setup();
    renderPage(deck(101, 102));

    await user.click(button('Passer'));
    expect(like).not.toHaveBeenCalled();

    await user.click(button('Liker'));

    await waitFor(() => expect(like).toHaveBeenCalledWith(102));
    expect(like).toHaveBeenCalledTimes(1);
  });

  /**
   * La carte quitte le deck avant l'accord du serveur : un swipe qui attendrait
   * le réseau bloquerait le paquet. L'échec part en toast, et l'endpoint est
   * idempotent.
   */
  it('avance dans le deck même si l’enregistrement du like échoue', async () => {
    const user = userEvent.setup();
    like.mockRejectedValue(new Error('réseau'));
    renderPage(deck(101, 102));

    await user.click(button('Liker'));

    expect(heading('Data Analyst')).toBeVisible();
  });

  it('réinitialise les filtres qui ont écarté toutes les offres', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(button('Stage'));
    await user.click(button('Full remote'));

    expect(heading('Aucune offre ne passe vos filtres')).toBeVisible();
    await user.click(button('Élargir la recherche'));

    expect(heading('Développeur Frontend React')).toBeVisible();
  });

  it('délègue l’ouverture de détail depuis la carte', async () => {
    const user = userEvent.setup();
    const onOpenOffer = vi.fn();
    renderPage(deck(101), onOpenOffer);

    await user.click(button("Voir l'offre Développeur Frontend React"));

    expect(onOpenOffer).toHaveBeenCalledWith(101);
  });

  it('prend les mêmes décisions au clavier et au glissement', async () => {
    const user = userEvent.setup();
    renderPage(deck(101, 102, 103));

    await user.keyboard('{ArrowRight}');
    expect(heading('Data Analyst')).toBeVisible();

    dragCard(-200);
    expect(heading('Développeur Full-Stack')).toBeVisible();
  });
});
