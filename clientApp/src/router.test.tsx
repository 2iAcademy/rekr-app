import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { USER_TYPES, type UserType } from '@/domain/userType';
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
  offerControllerCreate: vi.fn(),
  offerControllerFindMine: vi.fn(),
  offerControllerFindOneById: vi.fn(),
  offerControllerUpdate: vi.fn(),
  sectorControllerFindAll: vi.fn(),
}));

// The route table is plain data, so the placement of a screen can be asserted
// without mounting the application. Declared structurally rather than imported
// from react-router: only `path`, `element` and `children` are read here.
interface RouteLike {
  path?: string;
  element?: ReactNode;
  children?: RouteLike[];
}

const entries: RouteLike[] = routes;

/*
 * Layout routes nest — the shell now sits under the onboarding gate, and the
 * public screens under their own guard — so neither "declared" nor "under the
 * shell" can be read off the first level of the table any more.
 */
const flatten = (routeList: RouteLike[]): RouteLike[] =>
  routeList.flatMap((route) => [route, ...flatten(route.children ?? [])]);

const declaredPaths = (routeList: RouteLike[]): string[] =>
  flatten(routeList)
    .map((route) => route.path)
    .filter((path): path is string => path !== undefined);

const shellRoutes = flatten(entries).filter(
  (route) => isValidElement(route.element) && route.element.type === AppShell,
);

const insideShell = declaredPaths(shellRoutes.flatMap((route) => route.children ?? []));
const outsideShell = declaredPaths(entries);

const pathsAlsoInsideShell = (paths: string[]): string[] =>
  insideShell.filter((path) => paths.includes(path));

const shellChildren = shellRoutes.flatMap((route) => route.children ?? []);

// Who each screen of the shell is for. `AppShell` only settles the session, so
// a screen reserved to one user type has to guard the type itself, and the only
// way to assert that is to state the intent somewhere the specs can read. The
// completeness case below turns a child missing from this table into a failure,
// so declaring a route is not enough to slip past the guard-rail.
const ALLOWED_USER_TYPES: Record<string, readonly UserType[]> = {
  '/matches': USER_TYPES,
  '/profil': USER_TYPES,
  '/candidat/offres': ['candidate'],
  '/recruteur/offres': ['recruiter'],
  '/recruteur/offres/nouvelle': ['recruiter'],
  '/recruteur/offres/:id/edition': ['recruiter'],
};

// One case per screen and per user type it is *not* meant for.
const restrictedShellScreens = insideShell.flatMap((path) =>
  USER_TYPES.filter((userType) => !(ALLOWED_USER_TYPES[path] ?? USER_TYPES).includes(userType)).map(
    (userType) => ({ path, userType }),
  ),
);

const authenticateAs = (userType: UserType, hasProfile = true) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: { id: 1, email: 'camille@rekr.fr', role: 'user', userType, isActive: true, hasProfile },
    }),
  } as unknown as Response);
};

// The real router, not a local table: this is about what an anonymous visitor
// actually reaches through the application's own route tree.
const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
};

// The chrome the shell paints, queried by role so it does not depend on the
// labels the sidebar and the header own. None of it belongs on a login screen.
const shellChrome = () => [
  ...screen.queryAllByRole('complementary'),
  ...screen.queryAllByRole('navigation'),
  ...screen.queryAllByRole('link', { name: 'Mon profil' }),
];

describe('table de routage', () => {
  it('regroupe les écrans applicatifs sous un shell unique', () => {
    expect(shellRoutes).toHaveLength(1);
    expect([...insideShell].sort()).toEqual([
      '/candidat/offres',
      '/matches',
      '/profil',
      '/recruteur/offres',
      '/recruteur/offres/:id/edition',
      '/recruteur/offres/nouvelle',
    ]);
  });

  it('laisse hors du shell les écrans qui portent leur propre chrome plein cadre', () => {
    // `/offres/:id` rend son propre `<main>` et `/match` occupe tout l'écran :
    // sous le shell, chacun doublerait le point de repère principal de la page.
    const fullFramePaths = ['/offres/:id', '/match'];

    expect(outsideShell).toEqual(expect.arrayContaining(fullFramePaths));
    expect(pathsAlsoInsideShell(fullFramePaths)).toEqual([]);
  });

  it('laisse hors du shell les écrans d’authentification', () => {
    const authPaths = ['/', '/inscription', '/connexion', '/mot-de-passe-oublie'];

    expect(outsideShell).toEqual(expect.arrayContaining(authPaths));
    expect(pathsAlsoInsideShell(authPaths)).toEqual([]);
  });

  it('déclare une seule route attrape-tout', () => {
    expect(declaredPaths(entries).filter((path) => path === '*')).toHaveLength(1);
  });

  /**
   * Le deck de swipe recruteur a été retiré : un recruteur travaille depuis ses
   * annonces. L'ancienne adresse ne doit plus être servie, et c'est le
   * catch-all qui la reprend — pas une route laissée en place « au cas où ».
   */
  it('ne sert plus le deck de swipe recruteur', async () => {
    expect(insideShell).not.toContain('/recruteur/candidats');
    authenticateAs('recruiter');

    const router = renderAt('/recruteur/candidats');

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

// Placement alone says nothing about protection: a fourth child dropped under
// the shell would sit next to three guarded ones and be asserted by none of the
// specs above. These cases are generated from the route table itself, so such a
// child is covered the moment it is declared — no list to remember to extend.
describe('protection des écrans du shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // 401 on the boot refresh: the session settles on anonymous, which is the
    // state the guards have to survive.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
  });

  // A pathless child would never be reached by the cases below, so it would
  // escape the guard-rail silently. Counting is what closes that door.
  it('génère un cas pour chaque enfant du shell', () => {
    expect(insideShell).toHaveLength(shellChildren.length);
    expect(insideShell.length).toBeGreaterThan(0);
  });

  it.each(insideShell)('renvoie un visiteur anonyme de %s vers la connexion', async (path) => {
    const router = renderAt(path);

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connexion');
    expect(shellChrome()).toEqual([]);
  });

  // The anonymous cases above say nothing about roles, and the shell guards none:
  // a child reserved to recruiters and declared without its own role check would
  // sit here fully asserted and still be open to a candidate.
  it('déclare le type d’utilisateur attendu pour chaque enfant du shell', () => {
    expect(Object.keys(ALLOWED_USER_TYPES).sort()).toEqual([...insideShell].sort());
  });

  // Without this, allowing every type everywhere would silently empty the cases
  // below instead of failing.
  it('garde au moins un écran réservé à un seul type d’utilisateur', () => {
    expect(restrictedShellScreens.length).toBeGreaterThan(0);
  });

  /*
   * The chrome is no longer part of the assertion: the redirect now lands on the
   * user's own feed, which is another screen of the same shell, so the sidebar
   * legitimately survives. Where they end up is what says the refusal worked —
   * and it must be their home, not the anonymous splash they used to be sent to.
   */
  it.each(restrictedShellScreens)(
    'refuse $path à un utilisateur de type $userType et le renvoie chez lui',
    async ({ path, userType }) => {
      authenticateAs(userType);
      const router = renderAt(path);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          userType === 'recruiter' ? '/recruteur/candidats' : '/candidat/offres',
        );
      });
    },
  );
});

/**
 * The mirror image of the guards above, and the half that was missing: every
 * screen knew how to turn an anonymous visitor away, none knew what to do with
 * a settled session. `/` being both the public splash and the destination of
 * every `navigate('/')` in the application, signing in landed the user back on
 * the entry screen they had just come through.
 */
describe('écrans publics face à une session établie', () => {
  const publicPaths = ['/', '/connexion', '/inscription', '/mot-de-passe-oublie'];

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  /*
   * Generated from the route table rather than from the list above, so a fifth
   * public screen cannot be added without a case landing on it.
   */
  it('couvre tous les écrans publics déclarés', () => {
    expect(publicPaths.every((path) => outsideShell.includes(path))).toBe(true);
  });

  it.each(publicPaths)('renvoie un candidat instruit de %s vers son feed', async (path) => {
    authenticateAs('candidate');
    const router = renderAt(path);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/candidat/offres');
    });
  });

  it.each(publicPaths)('renvoie un recruteur instruit de %s vers son feed', async (path) => {
    authenticateAs('recruiter');
    const router = renderAt(path);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recruteur/candidats');
    });
  });

  /*
   * A session that never finished its wizard has no feed worth showing: the
   * gate has to hold on the public screens too, or signing in would be a way
   * around it.
   */
  it('renvoie un candidat sans profil vers son onboarding', async () => {
    authenticateAs('candidate', false);
    const router = renderAt('/connexion');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/candidat/onboarding');
    });
  });

  it('renvoie un recruteur sans profil vers son onboarding', async () => {
    authenticateAs('recruiter', false);
    const router = renderAt('/connexion');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recruteur/onboarding');
    });
  });

  /*
   * The redirect must not fire before the boot refresh has answered: a visitor
   * who is genuinely anonymous has to be able to reach the login form.
   */
  it('laisse un visiteur anonyme atteindre la connexion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    const router = renderAt('/connexion');

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connexion');
  });
});

/**
 * The onboarding gate. Reaching a feed without a profile shows an empty deck
 * and no explanation, and the matching has nothing to compare — so an
 * unfinished wizard is the only place such a session can usefully be.
 */
describe('parcours d’onboarding inachevé', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  const gatedPaths = ['/candidat/offres', '/matches', '/profil'];

  it.each(gatedPaths)('renvoie un candidat sans profil de %s vers son wizard', async (path) => {
    authenticateAs('candidate', false);
    const router = renderAt(path);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/candidat/onboarding');
    });
  });

  it('renvoie un recruteur sans profil vers son wizard', async () => {
    authenticateAs('recruiter', false);
    const router = renderAt('/recruteur/candidats');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recruteur/onboarding');
    });
  });

  /*
   * Otherwise the gate would send the session to the wizard, and the wizard
   * would send it back to its home — which is the wizard. The screen that
   * resolves the gate has to stay reachable.
   */
  it('laisse le wizard accessible à qui doit le remplir', async () => {
    authenticateAs('candidate', false);
    const router = renderAt('/candidat/onboarding');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/candidat/onboarding');
    });
  });

  /*
   * And once it is filled in, the wizard stops being home: coming back to it
   * would be a way to overwrite a finished profile through a creation form.
   */
  it('détourne du wizard une session déjà instruite', async () => {
    authenticateAs('candidate');
    const router = renderAt('/candidat/onboarding');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/candidat/offres');
    });
  });
});

/**
 * A mistyped URL used to land on the public splash whatever the session was —
 * the same dead end as signing in. It has to lead wherever the session belongs.
 */
describe('route inconnue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renvoie un candidat instruit vers son feed', async () => {
    authenticateAs('candidate');
    const router = renderAt('/une-page-qui-n-existe-pas');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/candidat/offres');
    });
  });

  it('renvoie un recruteur instruit vers son feed', async () => {
    authenticateAs('recruiter');
    const router = renderAt('/une-page-qui-n-existe-pas');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recruteur/candidats');
    });
  });

  it('renvoie un visiteur anonyme vers l’accueil public', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    const router = renderAt('/une-page-qui-n-existe-pas');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });
});

/**
 * The offer detail lives outside the shell because it paints its own full-frame
 * chrome — and it was the one screen that never got a guard of its own. Anyone
 * with the URL could read an offer without a session.
 */
describe('détail d’une offre', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renvoie un visiteur anonyme vers la connexion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    const router = renderAt('/offres/12');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/connexion');
    });
  });

  it('renvoie un candidat sans profil vers son onboarding', async () => {
    authenticateAs('candidate', false);
    const router = renderAt('/offres/12');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/candidat/onboarding');
    });
  });

  it('laisse passer un candidat instruit', async () => {
    authenticateAs('candidate');
    const router = renderAt('/offres/12');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/offres/12');
    });
  });
});
