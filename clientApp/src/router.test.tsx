import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Navigate, RouterProvider, type NavigateProps } from 'react-router';
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

const declaredPaths = (routeList: RouteLike[]): string[] =>
  routeList.map((route) => route.path).filter((path): path is string => path !== undefined);

const shellRoutes = entries.filter(
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
  '/recruteur/candidats': ['recruiter'],
  '/candidat/offres': ['candidate'],
};

// One case per screen and per user type it is *not* meant for.
const restrictedShellScreens = insideShell.flatMap((path) =>
  USER_TYPES.filter((userType) => !(ALLOWED_USER_TYPES[path] ?? USER_TYPES).includes(userType)).map(
    (userType) => ({ path, userType }),
  ),
);

const authenticateAs = (userType: UserType) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: { id: 1, email: 'camille@rekr.fr', role: 'user', userType, isActive: true },
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

const isRedirectTo = (node: ReactNode, to: string): boolean =>
  isValidElement<NavigateProps>(node) &&
  node.type === Navigate &&
  node.props.to === to &&
  node.props.replace === true;

describe('table de routage', () => {
  it('regroupe les écrans applicatifs sous un shell unique', () => {
    expect(shellRoutes).toHaveLength(1);
    expect([...insideShell].sort()).toEqual([
      '/candidat/offres',
      '/matches',
      '/profil',
      '/recruteur/candidats',
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

  it('renvoie toute route inconnue vers l’accueil', () => {
    const catchAll = entries.filter((route) => route.path === '*');

    expect(catchAll).toHaveLength(1);
    expect(catchAll.every((route) => isRedirectTo(route.element, '/'))).toBe(true);
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

  it.each(restrictedShellScreens)(
    'refuse $path à un utilisateur de type $userType',
    async ({ path, userType }) => {
      authenticateAs(userType);
      const router = renderAt(path);

      // Both inside `waitFor`: the router state changes a render before React
      // unmounts the shell, so reading the chrome right after the redirect
      // catches an `aside` that is on its way out.
      await waitFor(() => {
        expect(router.state.location.pathname).not.toBe(path);
        expect(shellChrome()).toEqual([]);
      });
    },
  );
});
