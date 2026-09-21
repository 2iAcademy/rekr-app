import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/customFetch';
import {
  likeControllerFindReceived,
  likeControllerFindSent,
  matchControllerFindMine,
  matchControllerUnmatch,
  type LikeListItemDto,
  type MatchListItemDto,
} from '@/api/generated';
import { Toaster } from '@/components/ui/sonner';
import type { AuthContextValue, AuthenticatedUser } from '@/features/auth/auth-context';
import { useAuth } from '@/features/auth/useAuth';
import { MatchesPage } from './MatchesPage';

vi.mock('@/api/generated', () => ({
  matchControllerFindMine: vi.fn(),
  matchControllerUnmatch: vi.fn(),
  likeControllerFindSent: vi.fn(),
  likeControllerFindReceived: vi.fn(),
}));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const getMatches = vi.mocked(matchControllerFindMine);
const getSent = vi.mocked(likeControllerFindSent);
const getReceived = vi.mocked(likeControllerFindReceived);
const unmatch = vi.mocked(matchControllerUnmatch);
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

/** Côté recruteur, la contrepartie du match est le candidat, pas la société. */
const aRecruiterMatch: MatchListItemDto = {
  id: 21,
  matchedAt: new Date().toISOString(),
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

/** Reads back what the page wrote in the URL, the tab being part of it now. */
function LocationProbe() {
  const location = useLocation();

  return (
    <>
      <span data-testid="location">{`${location.pathname}${location.search}`}</span>
      <span data-testid="state">{JSON.stringify(location.state)}</span>
    </>
  );
}

const renderPage = (entry = '/matches') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <MatchesPage />
      <LocationProbe />
      <Toaster />
    </MemoryRouter>,
  );

const noContent = () =>
  ({ data: undefined, status: 204 }) as unknown as Awaited<
    ReturnType<typeof matchControllerUnmatch>
  >;

const apiError = (status: number) =>
  new ApiError({ status, statusText: '', url: '/api/matches/12', data: undefined });

const currentUrl = () => screen.getByTestId('location').textContent;

const currentState = () => JSON.parse(screen.getByTestId('state').textContent || 'null') as unknown;

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
    unmatch.mockResolvedValue(noContent());
  });

  it('affiche les matches récupérés depuis l’API', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Matches' })).toBeInTheDocument();
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

  /**
   * Le métier du candidat ne dit pas pour quelle offre il a postulé, et le
   * recruteur en a plusieurs : sans l'offre, la liste est illisible.
   */
  it('affiche l’offre concernée sur une ligne de like reçu', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    renderPage();

    await openTab(user, 'Reçus');

    expect(await screen.findByText('Développeuse Back-End')).toBeInTheDocument();
    expect(screen.getByText('Offre : Développeur Back-End')).toBeInTheDocument();
  });

  it('affiche l’offre concernée sur une ligne de match de recruteur', async () => {
    authenticateAs('recruiter');
    getMatches.mockResolvedValue(matches([aRecruiterMatch]));
    renderPage();

    expect(await screen.findByText('Développeuse Back-End')).toBeInTheDocument();
    expect(screen.getByText('Offre : Développeur Back-End')).toBeInTheDocument();
  });

  it('mène du match aux candidats de l’offre côté recruteur', async () => {
    authenticateAs('recruiter');
    getMatches.mockResolvedValue(matches([aRecruiterMatch]));
    renderPage();

    expect(await screen.findByRole('link', { name: /Camille Durand/ })).toHaveAttribute(
      'href',
      '/recruteur/offres/41/candidats',
    );
  });

  /**
   * Le détail de l'offre connaît désormais l'état matché : il n'y propose plus
   * le retrait de like qui répondait 409, et la ligne peut y mener.
   */
  it('mène du match au détail de l’offre côté candidat', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: /Acme Corp/ })).toHaveAttribute(
      'href',
      '/offres/4',
    );
  });

  /**
   * Côté candidat, l'accroche de la société est déjà le titre de l'offre :
   * l'afficher une seconde fois ne dirait rien de plus.
   */
  it('ne répète pas l’offre côté candidat', async () => {
    renderPage();

    expect(await screen.findByText('Développeur Full-Stack')).toBeInTheDocument();
    expect(screen.queryByText(/^Offre :/)).not.toBeInTheDocument();
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

  // Le titre nomme ce qui est affiché : un recruteur sur « Reçus » ne lit pas
  // « Tes matches ».
  it('titre l’écran avec l’onglet ouvert', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    renderPage();

    expect(screen.getByRole('heading', { name: 'Matches' })).toBeInTheDocument();

    await openTab(user, 'Reçus');

    expect(screen.getByRole('heading', { name: 'Reçus' })).toBeInTheDocument();
  });

  /**
   * Le bouton est le seul garde-fou : tant que la page en vol n'est pas
   * arrivée, un second clic ne doit ni partir ni sauter une page.
   */
  it('désactive « Voir plus » et le dit pendant le chargement de la page suivante', async () => {
    const user = userEvent.setup();
    let releaseSecondPage!: (data: LikeListItemDto[]) => void;
    const secondPage = new Promise<Awaited<ReturnType<typeof likeControllerFindSent>>>(
      (resolve) => {
        releaseSecondPage = (data) => resolve(likes(data));
      },
    );

    getSent.mockResolvedValueOnce(likes(aFullPageOfSentLikes(100)));
    getSent.mockReturnValueOnce(secondPage);
    renderPage();

    await openTab(user, 'Mes likes');
    await screen.findByText('Société 100');

    await user.click(screen.getByRole('button', { name: 'Voir plus' }));

    const pending = await screen.findByRole('button', { name: 'Chargement…' });
    expect(pending).toBeDisabled();

    await user.click(pending);
    releaseSecondPage(aFullPageOfSentLikes(200).slice(0, 4));

    expect(await screen.findByText('Société 200')).toBeInTheDocument();
    expect(getSent.mock.calls.map(([query]) => query?.page)).toEqual([1, 2]);
    expect(screen.getByText('Société 100')).toBeInTheDocument();
  });

  it('garde les lignes déjà chargées quand la page suivante échoue', async () => {
    const user = userEvent.setup();
    getSent.mockResolvedValueOnce(likes(aFullPageOfSentLikes(100)));
    getSent.mockRejectedValueOnce(new Error('API indisponible'));
    renderPage();

    await openTab(user, 'Mes likes');
    await screen.findByText('Société 100');

    await user.click(screen.getByRole('button', { name: 'Voir plus' }));

    // Le message ne nomme pas la liste : elle est sous les yeux du lecteur.
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger la suite.');
    expect(screen.queryByText(/Impossible de charger tes likes/)).not.toBeInTheDocument();
    expect(screen.getByText('Société 100')).toBeInTheDocument();
    expect(screen.getByText('Société 149')).toBeInTheDocument();
  });

  it('permet de réessayer la page suivante après son échec', async () => {
    const user = userEvent.setup();
    getSent.mockResolvedValueOnce(likes(aFullPageOfSentLikes(100)));
    getSent.mockRejectedValueOnce(new Error('API indisponible'));
    getSent.mockResolvedValueOnce(likes(aFullPageOfSentLikes(200).slice(0, 3)));
    renderPage();

    await openTab(user, 'Mes likes');
    await screen.findByText('Société 100');

    await user.click(screen.getByRole('button', { name: 'Voir plus' }));
    await user.click(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Société 200')).toBeInTheDocument();
    expect(screen.getByText('Société 100')).toBeInTheDocument();
    // La page rejetée est redemandée, pas sautée.
    expect(getSent.mock.calls.map(([query]) => query?.page)).toEqual([1, 2, 2]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // L'onglet vit dans l'URL : c'est ce qui permet d'y revenir depuis un écran
  // de détail, et de le retrouver après un rechargement.
  it('ouvre l’onglet nommé par l’URL', async () => {
    authenticateAs('recruiter');
    renderPage('/matches?onglet=recus');

    expect(screen.getByRole('tab', { name: 'Reçus' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('Camille Durand');
  });

  it.each([
    ['inconnu', '/matches?onglet=n-importe-quoi'],
    ['absent', '/matches'],
  ])('retombe sur le premier onglet quand le paramètre est %s', (_, entry) => {
    renderPage(entry);

    expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true');
  });

  // Un candidat n'a pas d'onglet « Reçus » : l'URL ne doit pas lui en ouvrir un.
  it('retombe sur le premier onglet quand l’URL nomme un onglet interdit au rôle', () => {
    renderPage('/matches?onglet=recus');

    expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true');
    expect(getReceived).not.toHaveBeenCalled();
  });

  it('inscrit l’onglet ouvert dans l’URL', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(currentUrl()).toBe('/matches');

    await openTab(user, 'Mes likes');

    expect(currentUrl()).toBe('/matches?onglet=mes-likes');
  });

  it('transporte l’origine dans le lien d’une ligne', async () => {
    const user = userEvent.setup();
    renderPage();

    await openTab(user, 'Mes likes');
    await user.click(await screen.findByRole('link', { name: /Orbit/ }));

    // Le lien mène au détail, en disant d'où on vient : l'onglet compris.
    expect(currentUrl()).toBe('/offres/30');
    expect(currentState()).toEqual({ from: '/matches?onglet=mes-likes' });
  });

  it('n’expose que les lignes de l’onglet ouvert dans sa liste', async () => {
    const user = userEvent.setup();
    renderPage();

    await openTab(user, 'Mes likes');

    const list = await screen.findByRole('list', { name: 'Mes likes liste' });

    expect(within(list).getByText('Orbit')).toBeInTheDocument();
  });

  /**
   * Mettre fin à un match est irréversible et se joue dans une liste, à côté de
   * lignes voisines : la confirmation en deux temps est là pour qu'un clic de
   * trop ne défasse rien.
   */
  describe('fin du match', () => {
    const endMatchButton = (name: string) =>
      screen.getByRole('button', { name: `Mettre fin au match avec ${name}` });

    const confirmButton = (name: string) =>
      screen.getByRole('button', { name: `Confirmer la fin du match avec ${name}` });

    it('propose de mettre fin au match sur une ligne de match côté candidat', async () => {
      renderPage();

      await screen.findByText('Acme Corp');

      expect(endMatchButton('Acme Corp')).toBeInTheDocument();
    });

    it('propose de mettre fin au match sur une ligne de match côté recruteur', async () => {
      authenticateAs('recruiter');
      getMatches.mockResolvedValue(matches([aRecruiterMatch]));
      renderPage();

      await screen.findByText('Camille Durand');

      expect(endMatchButton('Camille Durand')).toBeInTheDocument();
    });

    // Un like sans match n'a pas de match à défaire : l'action n'a rien à y faire.
    it('ne propose pas de fin de match sur l’onglet Mes likes', async () => {
      const user = userEvent.setup();
      renderPage();

      await openTab(user, 'Mes likes');
      await screen.findByText('Orbit');

      expect(screen.queryByRole('button', { name: /Mettre fin au match/ })).not.toBeInTheDocument();
    });

    it('ne propose pas de fin de match sur l’onglet Reçus', async () => {
      const user = userEvent.setup();
      authenticateAs('recruiter');
      renderPage();

      await openTab(user, 'Reçus');
      await screen.findByText('Camille Durand');

      expect(screen.queryByRole('button', { name: /Mettre fin au match/ })).not.toBeInTheDocument();
    });

    it('n’appelle rien avant confirmation', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Acme Corp');
      await user.click(endMatchButton('Acme Corp'));

      expect(unmatch).not.toHaveBeenCalled();
      expect(confirmButton('Acme Corp')).toBeInTheDocument();
    });

    it('n’appelle rien quand la confirmation est annulée', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Acme Corp');
      await user.click(endMatchButton('Acme Corp'));
      await user.click(screen.getByRole('button', { name: 'Annuler' }));

      expect(unmatch).not.toHaveBeenCalled();
      expect(endMatchButton('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('retire la ligne et le confirme une fois le match supprimé', async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByText('Acme Corp');
      await user.click(endMatchButton('Acme Corp'));
      await user.click(confirmButton('Acme Corp'));

      await waitFor(() => expect(unmatch).toHaveBeenCalledExactlyOnceWith(12));
      await waitFor(() => expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument());
      expect(await screen.findByText('Le match avec Acme Corp est terminé.')).toBeVisible();
      expect(screen.getByText('Aucun match pour le moment.')).toBeInTheDocument();
    });

    /**
     * Un 404 veut dire que le match n'est plus là — l'autre membre l'a défait,
     * ou l'écran est resté ouvert. La ligne doit disparaître : la garder
     * mentirait au lecteur.
     */
    it('retire la ligne quand le match a déjà été supprimé', async () => {
      const user = userEvent.setup();
      unmatch.mockRejectedValue(apiError(404));
      renderPage();

      await screen.findByText('Acme Corp');
      await user.click(endMatchButton('Acme Corp'));
      await user.click(confirmButton('Acme Corp'));

      await waitFor(() => expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument());
      expect(screen.getByText('Aucun match pour le moment.')).toBeInTheDocument();
    });

    it('garde la ligne et permet de réessayer quand le serveur échoue', async () => {
      const user = userEvent.setup();
      unmatch.mockRejectedValueOnce(apiError(500));
      renderPage();

      await screen.findByText('Acme Corp');
      await user.click(endMatchButton('Acme Corp'));
      await user.click(confirmButton('Acme Corp'));

      expect(
        await screen.findByText('Une erreur est survenue. Réessayez dans un instant.'),
      ).toBeVisible();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();

      const retry = endMatchButton('Acme Corp');
      expect(retry).toBeEnabled();

      await user.click(retry);
      await user.click(confirmButton('Acme Corp'));

      await waitFor(() => expect(unmatch).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument());
    });

    /**
     * La confirmation est le seul garde-fou : tant que l'appel est en vol, un
     * second clic ne doit pas partir.
     */
    it('désactive la confirmation pendant l’appel', async () => {
      const user = userEvent.setup();
      let release!: () => void;
      unmatch.mockReturnValueOnce(
        new Promise((resolve) => {
          release = () => resolve(noContent());
        }),
      );
      renderPage();

      await screen.findByText('Acme Corp');
      await user.click(endMatchButton('Acme Corp'));
      await user.click(confirmButton('Acme Corp'));

      const pending = await screen.findByRole('button', { name: 'Suppression…' });
      expect(pending).toBeDisabled();

      await user.click(pending);
      release();

      await waitFor(() => expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument());
      expect(unmatch).toHaveBeenCalledTimes(1);
    });

    // Chaque ligne porte son propre match : la confirmation de l'une ne doit ni
    // supprimer ni faire disparaître la voisine.
    it('ne retire que la ligne confirmée', async () => {
      const user = userEvent.setup();
      getMatches.mockResolvedValue(
        matches([
          aMatch,
          {
            ...aMatch,
            id: 13,
            counterpart: { ...aMatch.counterpart, name: 'Orbit' },
          },
        ]),
      );
      renderPage();

      await screen.findByText('Acme Corp');
      await user.click(endMatchButton('Orbit'));
      await user.click(confirmButton('Orbit'));

      await waitFor(() => expect(unmatch).toHaveBeenCalledExactlyOnceWith(13));
      await waitFor(() => expect(screen.queryByText('Orbit')).not.toBeInTheDocument());
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });
});
