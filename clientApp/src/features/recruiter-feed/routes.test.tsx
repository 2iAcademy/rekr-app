import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { routes } from '@/router';

vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
  authControllerLogout: vi.fn(),
  authControllerSignup: vi.fn(),
  candidateProfileControllerCreate: vi.fn(),
  candidateProfileControllerUpdate: vi.fn(),
  companyControllerCreate: vi.fn(),
  companyControllerUpdateMine: vi.fn(),
  matchControllerFindMine: vi.fn().mockResolvedValue({ data: [] }),
  offerControllerCreate: vi.fn(),
  sectorControllerFindAll: vi.fn(),
}));

const authenticateAs = (userType: 'candidate' | 'recruiter', hasProfile = true) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 1,
        email: 'a@rekr.fr',
        role: 'user',
        userType,
        isActive: true,
        hasProfile,
      },
    }),
  } as unknown as Response);
};

// The router is returned so a test can walk the history back and check what the
// profile left behind in it. `previousPath` seeds an entry underneath the one
// rendered, which is what makes a pushed correction distinguishable from a
// replaced one.
const renderAt = (path: string, previousPath?: string) => {
  const entries = previousPath === undefined ? [path] : [previousPath, path];
  const router = createMemoryRouter(routes, {
    initialEntries: entries,
    initialIndex: entries.length - 1,
  });

  // Subscribed before the render so the very first URL correction is recorded:
  // a correction that keeps retriggering itself shows up here as a growing list.
  const locations: string[] = [];
  router.subscribe(({ location }) => {
    locations.push(`${location.pathname}${location.search}`);
  });

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return { router, locations };
};

type TestRouter = ReturnType<typeof renderAt>['router'];

const goBack = (router: TestRouter) =>
  act(async () => {
    await router.navigate(-1);
  });

const profileParam = (router: TestRouter): string | null =>
  new URLSearchParams(router.state.location.search).get('profil');

const feedHeading = () => screen.queryByRole('heading', { level: 1, name: 'Candidats' });
const profileHeading = () =>
  screen.queryByRole('heading', { level: 1, name: 'Camille Moreau · 29 ans' });

describe('navigation vers le feed recruteur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
  });

  it('affiche le feed pour un recruteur connecté', async () => {
    authenticateAs('recruiter');
    renderAt('/recruteur/candidats');

    expect(await screen.findByRole('heading', { level: 1, name: 'Candidats' })).toBeInTheDocument();
  });

  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderAt('/recruteur/candidats');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(feedHeading()).not.toBeInTheDocument();
  });

  it('renvoie un candidat connecté vers son propre feed', async () => {
    authenticateAs('candidate');
    renderAt('/recruteur/candidats');

    expect(await screen.findByRole('heading', { level: 1, name: 'Offres' })).toBeInTheDocument();
    expect(feedHeading()).not.toBeInTheDocument();
  });

  it('n’affiche rien tant que la session est en cours de vérification', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderAt('/recruteur/candidats');

    expect(feedHeading()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });
});

describe('accès au détail d’un candidat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
  });

  it('affiche le profil ciblé pour un recruteur connecté', async () => {
    authenticateAs('recruiter');
    renderAt('/recruteur/candidats?profil=1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Camille Moreau · 29 ans' }),
    ).toBeInTheDocument();
  });

  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderAt('/recruteur/candidats?profil=1');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(profileHeading()).not.toBeInTheDocument();
  });

  it('renvoie un candidat connecté vers son propre feed', async () => {
    authenticateAs('candidate');
    renderAt('/recruteur/candidats?profil=1');

    expect(await screen.findByRole('heading', { level: 1, name: 'Offres' })).toBeInTheDocument();
    expect(profileHeading()).not.toBeInTheDocument();
  });

  it.each(['', 'abc', '-1', '0', '1.5', ' 1 ', '01x', '3 '])(
    'ignore un paramètre de profil invalide et le retire de l’URL (%j)',
    async (raw) => {
      authenticateAs('recruiter');
      const { router, locations } = renderAt(
        `/recruteur/candidats?profil=${encodeURIComponent(raw)}`,
      );

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Candidats' }),
      ).toBeInTheDocument();
      expect(profileHeading()).not.toBeInTheDocument();
      await waitFor(() => expect(locations).toEqual(['/recruteur/candidats']));
      expect(profileParam(router)).toBeNull();
    },
  );

  it('retire de l’URL un identifiant bien formé mais inconnu', async () => {
    authenticateAs('recruiter');
    const { router, locations } = renderAt('/recruteur/candidats?profil=999');

    expect(await screen.findByRole('heading', { level: 1, name: 'Candidats' })).toBeInTheDocument();
    await waitFor(() => expect(locations).toEqual(['/recruteur/candidats']));
    expect(profileParam(router)).toBeNull();
  });

  it('normalise un identifiant écrit sous une forme non canonique', async () => {
    authenticateAs('recruiter');
    const { router } = renderAt('/recruteur/candidats?profil=007');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Léa Bonnet · 31 ans' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(profileParam(router)).toBe('7'));
  });

  it('laisse intacte l’URL d’un identifiant déjà canonique', async () => {
    authenticateAs('recruiter');
    const { router, locations } = renderAt('/recruteur/candidats?profil=3');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sofia Nguyen · 35 ans' }),
    ).toBeInTheDocument();
    expect(profileParam(router)).toBe('3');
    expect(locations).toEqual([]);
  });

  it('ne corrige l’URL qu’une seule fois', async () => {
    authenticateAs('recruiter');
    const { locations } = renderAt('/recruteur/candidats?profil=007');

    await screen.findByRole('heading', { level: 1, name: 'Léa Bonnet · 31 ans' });
    await waitFor(() => expect(locations).toEqual(['/recruteur/candidats?profil=7']));
  });

  it('ne réécrit pas l’URL d’un visiteur qui est redirigé', async () => {
    const { locations } = renderAt('/recruteur/candidats?profil=abc');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    await waitFor(() => expect(locations).toEqual(['/connexion']));
  });

  it('ne laisse pas d’entrée d’historique en corrigeant l’URL', async () => {
    authenticateAs('recruiter');
    const { router } = renderAt('/recruteur/candidats?profil=abc', '/matches');

    expect(await screen.findByRole('heading', { level: 1, name: 'Candidats' })).toBeInTheDocument();

    await goBack(router);

    // Had the correction been pushed, this back would step onto `?profil=abc`
    // and the recruiter would need a second one to leave the feed.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tes matches' }),
    ).toBeInTheDocument();
  });

  it('referme le profil au retour du navigateur', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    const { router } = renderAt('/recruteur/candidats');

    await user.click(
      await screen.findByRole('button', { name: 'Voir le profil de Camille Moreau' }),
    );
    expect(profileHeading()).toBeInTheDocument();

    await goBack(router);

    expect(feedHeading()).toBeInTheDocument();
    expect(profileHeading()).not.toBeInTheDocument();
  });

  it('ne laisse pas d’entrée d’historique en refermant le profil', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    const { router } = renderAt('/recruteur/candidats');

    await user.click(
      await screen.findByRole('button', { name: 'Voir le profil de Camille Moreau' }),
    );
    await user.click(screen.getByRole('button', { name: 'Retour au feed' }));

    await goBack(router);

    // Had the close been pushed, this back would step onto `?profil=1` and
    // reopen the profile the recruiter just dismissed.
    expect(feedHeading()).toBeInTheDocument();
    expect(profileHeading()).not.toBeInTheDocument();
  });
});
