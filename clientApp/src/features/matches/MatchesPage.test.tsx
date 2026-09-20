import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  likeControllerFindReceived,
  likeControllerFindSent,
  matchControllerFindMine,
  type LikeListItemDto,
  type MatchListItemDto,
} from '@/api/generated';
import type { AuthContextValue, AuthenticatedUser } from '@/features/auth/auth-context';
import { useAuth } from '@/features/auth/useAuth';
import { MatchesPage } from './MatchesPage';

vi.mock('@/api/generated', () => ({
  matchControllerFindMine: vi.fn(),
  likeControllerFindSent: vi.fn(),
  likeControllerFindReceived: vi.fn(),
}));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const getMatches = vi.mocked(matchControllerFindMine);
const getSent = vi.mocked(likeControllerFindSent);
const getReceived = vi.mocked(likeControllerFindReceived);
const session = vi.mocked(useAuth);

const PAGE_SIZE = 50;

const authenticateAs = (userType: 'candidate' | 'recruiter') => {
  const user: AuthenticatedUser = {
    id: 1,
    email: 'a@rekr.fr',
    role: 'user',
    userType,
    isActive: true,
    hasProfile: true,
  };

  session.mockReturnValue({ status: 'authenticated', user } as unknown as AuthContextValue);
};

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

const aSentLike: LikeListItemDto = {
  offerId: 30,
  candidateUserId: null,
  likedAt: new Date().toISOString(),
  offer: { id: 30, title: 'Data Analyst' },
  counterpart: {
    id: 9,
    kind: 'company',
    name: 'Orbit',
    headline: 'Data Analyst',
    avatarUrl: null,
  },
};

const aReceivedLike: LikeListItemDto = {
  offerId: 41,
  candidateUserId: 77,
  likedAt: new Date().toISOString(),
  offer: { id: 41, title: 'Développeur Back-End' },
  counterpart: {
    id: 77,
    kind: 'candidate',
    name: 'Camille Durand',
    headline: 'Développeuse Back-End',
    avatarUrl: null,
  },
};

const matches = (data: MatchListItemDto[]) =>
  ({ data }) as Awaited<ReturnType<typeof matchControllerFindMine>>;

const likes = (data: LikeListItemDto[]) =>
  ({ data }) as Awaited<ReturnType<typeof likeControllerFindSent>>;

/** A full page of distinct rows, which is what tells the page one more exists. */
const aFullPageOfSentLikes = (from: number) =>
  Array.from({ length: PAGE_SIZE }, (_, index) => ({
    ...aSentLike,
    offerId: from + index,
    offer: { id: from + index, title: `Offre ${from + index}` },
    counterpart: { ...aSentLike.counterpart, name: `Société ${from + index}` },
  }));

const aFullPageOfMatches = (from: number) =>
  Array.from({ length: PAGE_SIZE }, (_, index) => ({
    ...aMatch,
    id: from + index,
    counterpart: { ...aMatch.counterpart, name: `Société ${from + index}` },
  }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <MatchesPage />
    </MemoryRouter>,
  );

const openTab = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('tab', { name }));

  await waitFor(() =>
    expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true'),
  );
};

const tabLabels = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

describe('MatchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateAs('candidate');
    getMatches.mockResolvedValue(matches([aMatch]));
    getSent.mockResolvedValue(likes([aSentLike]));
    getReceived.mockResolvedValue(likes([aReceivedLike]));
  });

  it('affiche les matches récupérés depuis l’API', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Tes matches' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
  });

  /**
   * Les onglets sont asymétriques par rôle. Un recruteur ne peut liker qu'un
   * candidat qui a déjà liké son offre, et ce like crée le match : « Mes likes »
   * serait vide par construction de son côté, et « Reçus » impossible côté
   * candidat.
   */
  it('propose Matches et Mes likes au candidat, sans onglet Reçus', () => {
    renderPage();

    expect(tabLabels()).toEqual(['Matches', 'Mes likes']);
  });

  it('propose Matches et Reçus au recruteur, sans onglet Mes likes', () => {
    authenticateAs('recruiter');
    renderPage();

    expect(tabLabels()).toEqual(['Matches', 'Reçus']);
  });

  it('liste les offres likées sans match depuis /likes/sent', async () => {
    const user = userEvent.setup();
    renderPage();

    await openTab(user, 'Mes likes');

    expect(getSent).toHaveBeenCalledOnce();
    expect(await screen.findByText('Orbit')).toBeInTheDocument();
    expect(screen.getByText('Data Analyst')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('liste les candidats intéressés depuis /likes/received', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    renderPage();

    await openTab(user, 'Reçus');

    expect(getReceived).toHaveBeenCalledOnce();
    expect(await screen.findByText('Camille Durand')).toBeInTheDocument();
    expect(screen.getByText('Développeuse Back-End')).toBeInTheDocument();
  });

  // Chargées à l'ouverture de l'onglet, pas au montage : la moitié des lecteurs
  // ne l'ouvriront jamais.
  it('ne charge les likes qu’à l’ouverture de leur onglet', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Acme Corp');
    expect(getSent).not.toHaveBeenCalled();

    await openTab(user, 'Mes likes');

    expect(getSent).toHaveBeenCalledOnce();
  });

  it.each([
    ['Matches', 'Aucun match pour le moment.'],
    ['Mes likes', 'Vous n’avez encore liké aucune offre.'],
  ])('affiche un état vide propre à l’onglet %s', async (tab, message) => {
    const user = userEvent.setup();
    getMatches.mockResolvedValue(matches([]));
    getSent.mockResolvedValue(likes([]));
    renderPage();

    if (tab !== 'Matches') {
      await openTab(user, tab);
    }

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('affiche un état vide propre à l’onglet Reçus', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    getReceived.mockResolvedValue(likes([]));
    renderPage();

    await openTab(user, 'Reçus');

    expect(
      await screen.findByText('Aucun candidat n’a encore liké tes offres.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['Matches', 'Impossible de charger tes matches.'],
    ['Mes likes', 'Impossible de charger tes likes.'],
  ])('signale l’échec de chargement de l’onglet %s', async (tab, message) => {
    const user = userEvent.setup();
    getMatches.mockRejectedValue(new Error('API indisponible'));
    getSent.mockRejectedValue(new Error('API indisponible'));
    renderPage();

    if (tab !== 'Matches') {
      await openTab(user, tab);
    }

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('signale l’échec de chargement de l’onglet Reçus', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    getReceived.mockRejectedValue(new Error('API indisponible'));
    renderPage();

    await openTab(user, 'Reçus');

    expect(await screen.findByText('Impossible de charger les likes reçus.')).toBeInTheDocument();
  });

  it('n’affiche aucun résultat tant que l’onglet charge', () => {
    renderPage();

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.queryByText('Aucun match pour le moment.')).not.toBeInTheDocument();
  });

  // Un lien, pas un `div` cliquable : la ligne doit être atteignable au clavier
  // et ouvrable dans un nouvel onglet.
  it('mène de l’offre likée à son détail', async () => {
    const user = userEvent.setup();
    renderPage();

    await openTab(user, 'Mes likes');

    expect(await screen.findByRole('link', { name: /Orbit/ })).toHaveAttribute(
      'href',
      '/offres/30',
    );
  });

  it('mène du like reçu aux candidats de l’offre', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    renderPage();

    await openTab(user, 'Reçus');

    expect(await screen.findByRole('link', { name: /Camille Durand/ })).toHaveAttribute(
      'href',
      '/recruteur/offres/41/candidats',
    );
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

    const { container } = renderPage();

    await screen.findByText('Acme Corp');

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/api/files/companies/8/logo/acme.webp',
    );
  });

  /**
   * Une page pleine est le seul signal qu'il en reste une : l'API ne renvoie
   * pas de total, et en demander un coûterait un COUNT à chaque défilement.
   */
  it('propose de charger la suite des likes quand la page est pleine', async () => {
    const user = userEvent.setup();
    getSent.mockResolvedValueOnce(likes(aFullPageOfSentLikes(100)));
    getSent.mockResolvedValueOnce(likes(aFullPageOfSentLikes(200).slice(0, 3)));
    renderPage();

    await openTab(user, 'Mes likes');

    await screen.findByText('Société 100');
    expect(getSent).toHaveBeenCalledWith({ page: 1, limit: PAGE_SIZE });

    await user.click(screen.getByRole('button', { name: 'Voir plus' }));

    expect(await screen.findByText('Société 200')).toBeInTheDocument();
    expect(getSent).toHaveBeenLastCalledWith({ page: 2, limit: PAGE_SIZE });
    // La page 2 s'ajoute à la première, elle ne la remplace pas.
    expect(screen.getByText('Société 100')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voir plus' })).not.toBeInTheDocument();
  });

  it('ne propose pas de charger la suite quand la page n’est pas pleine', async () => {
    const user = userEvent.setup();
    renderPage();

    await openTab(user, 'Mes likes');
    await screen.findByText('Orbit');

    expect(screen.queryByRole('button', { name: 'Voir plus' })).not.toBeInTheDocument();
  });

  it('propose de charger la suite des matches quand la page est pleine', async () => {
    const user = userEvent.setup();
    getMatches.mockResolvedValueOnce(matches(aFullPageOfMatches(100)));
    getMatches.mockResolvedValueOnce(matches(aFullPageOfMatches(200).slice(0, 1)));
    renderPage();

    await screen.findByText('Société 100');

    await user.click(screen.getByRole('button', { name: 'Voir plus' }));

    expect(await screen.findByText('Société 200')).toBeInTheDocument();
    expect(getMatches).toHaveBeenLastCalledWith({ page: 2, limit: PAGE_SIZE });
    expect(screen.queryByRole('button', { name: 'Voir plus' })).not.toBeInTheDocument();
  });

  it('ne propose pas de charger la suite des matches sur une page partielle', async () => {
    renderPage();

    await screen.findByText('Acme Corp');

    expect(screen.queryByRole('button', { name: 'Voir plus' })).not.toBeInTheDocument();
  });

  // Le bouton appartient à l'onglet ouvert : la pagination de l'un ne doit pas
  // se lire sur l'autre.
  it('garde la pagination de chaque onglet dans son onglet', async () => {
    const user = userEvent.setup();
    getMatches.mockResolvedValue(matches([aMatch]));
    getSent.mockResolvedValue(likes(aFullPageOfSentLikes(100)));
    renderPage();

    await openTab(user, 'Mes likes');
    expect(await screen.findByRole('button', { name: 'Voir plus' })).toBeInTheDocument();

    await openTab(user, 'Matches');

    expect(screen.queryByRole('button', { name: 'Voir plus' })).not.toBeInTheDocument();
  });

  it('n’expose que les lignes de l’onglet ouvert dans sa liste', async () => {
    const user = userEvent.setup();
    renderPage();

    await openTab(user, 'Mes likes');

    const list = await screen.findByRole('list', { name: 'Mes likes liste' });

    expect(within(list).getByText('Orbit')).toBeInTheDocument();
  });
});
