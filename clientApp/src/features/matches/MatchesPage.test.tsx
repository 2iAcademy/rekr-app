import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  matchControllerFindMine,
  offerControllerFindLiked,
  type MatchListItemDto,
  type OfferFeedItemDto,
} from '@/api/generated';
import { MatchesPage } from './MatchesPage';

vi.mock('@/api/generated', () => ({
  matchControllerFindMine: vi.fn(),
  offerControllerFindLiked: vi.fn(),
}));

const getMatches = vi.mocked(matchControllerFindMine);
const getLiked = vi.mocked(offerControllerFindLiked);

const aMatch: MatchListItemDto = {
  id: 12,
  matchedAt: new Date().toISOString(),
  offer: { id: 4, title: 'Développeur Full-Stack' },
  counterpart: {
    id: 8,
    kind: 'company',
    name: 'Acme Corp',
    headline: 'Développeur Full-Stack',
    avatarUrl: null,
  },
};

const aLikedOffer: OfferFeedItemDto = {
  id: 30,
  title: 'Data Analyst',
  description: null,
  city: 'Lyon',
  contractType: 'CDI',
  minExperienceLevel: null,
  remotePolicy: null,
  salaryMin: null,
  salaryMax: null,
  createdAt: new Date().toISOString(),
  company: { id: 9, name: 'Orbit', logo: null },
  tags: [],
};

const matches = (data: MatchListItemDto[]) =>
  ({ data }) as Awaited<ReturnType<typeof matchControllerFindMine>>;

const liked = (data: OfferFeedItemDto[]) =>
  ({ data }) as Awaited<ReturnType<typeof offerControllerFindLiked>>;

const openLikes = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('tab', { name: 'Mes likes' }));

  await waitFor(() =>
    expect(screen.getByRole('tab', { name: 'Mes likes' })).toHaveAttribute('aria-selected', 'true'),
  );
};

describe('MatchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMatches.mockResolvedValue(matches([aMatch]));
    getLiked.mockResolvedValue(liked([aLikedOffer]));
  });

  it('affiche les matches récupérés depuis l’API', async () => {
    render(<MatchesPage />);

    expect(screen.getByRole('heading', { name: 'Tes matches' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
  });

  /**
   * Deux onglets, et deux seulement. « Reçus » a été retiré : un candidat like
   * un poste, et si le recruteur le retient cela devient un match — il n'y a
   * pas d'état intermédiaire à lui montrer.
   */
  it('ne propose plus l’onglet des likes reçus', () => {
    render(<MatchesPage />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Matches',
      'Mes likes',
    ]);
  });

  // L'onglet tournait sur des données écrites en dur ; il lit désormais les
  // offres réellement likées.
  it('liste les offres réellement likées', async () => {
    const user = userEvent.setup();
    render(<MatchesPage />);

    await openLikes(user);

    expect(getLiked).toHaveBeenCalledOnce();
    expect(await screen.findByText('Orbit')).toBeInTheDocument();
    expect(screen.getByText('Data Analyst')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  // Chargées à l'ouverture de l'onglet, pas au montage : la moitié des lecteurs
  // ne l'ouvriront jamais.
  it('ne charge les likes qu’à l’ouverture de leur onglet', async () => {
    const user = userEvent.setup();
    render(<MatchesPage />);

    await screen.findByText('Acme Corp');
    expect(getLiked).not.toHaveBeenCalled();

    await openLikes(user);

    expect(getLiked).toHaveBeenCalledOnce();
  });

  it.each([
    ['Matches', 'Aucun match pour le moment.'],
    ['Mes likes', 'Vous n’avez encore liké aucune offre.'],
  ])('affiche un état vide propre à l’onglet %s', async (tab, message) => {
    const user = userEvent.setup();
    getMatches.mockResolvedValue(matches([]));
    getLiked.mockResolvedValue(liked([]));
    render(<MatchesPage />);

    if (tab === 'Mes likes') {
      await openLikes(user);
    }

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it.each([
    ['Matches', 'Impossible de charger tes matches.'],
    ['Mes likes', 'Impossible de charger tes likes.'],
  ])('signale l’échec de chargement de l’onglet %s', async (tab, message) => {
    const user = userEvent.setup();
    getMatches.mockRejectedValue(new Error('API indisponible'));
    getLiked.mockRejectedValue(new Error('API indisponible'));
    render(<MatchesPage />);

    if (tab === 'Mes likes') {
      await openLikes(user);
    }

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('n’affiche aucun résultat tant que l’onglet charge', () => {
    render(<MatchesPage />);

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.queryByText('Aucun match pour le moment.')).not.toBeInTheDocument();
  });

  it('convertit la clé de stockage de l’avatar en URL de fichier', async () => {
    getMatches.mockResolvedValue(
      matches([
        {
          ...aMatch,
          counterpart: { ...aMatch.counterpart, avatarUrl: 'companies/8/logo/acme.webp' },
        },
      ]),
    );

    const { container } = render(<MatchesPage />);

    await screen.findByText('Acme Corp');

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/api/files/companies/8/logo/acme.webp',
    );
  });
});
