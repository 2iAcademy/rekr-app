import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { offerControllerFindMine, offerControllerFindOneById } from '@/api/generated';
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

const findMine = vi.mocked(offerControllerFindMine);
const findOneById = vi.mocked(offerControllerFindOneById);

const answer = (data: unknown) =>
  ({ data, status: 200, headers: new Headers() }) as unknown as Awaited<
    ReturnType<typeof offerControllerFindMine>
  >;

const authenticateAs = (userType: 'candidate' | 'recruiter') => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 1,
        email: 'sacha@rekr.fr',
        role: 'user',
        userType,
        isActive: true,
        hasProfile: true,
      },
    }),
  } as unknown as Response);
};

// The real route tree, not a local table: which screen a URL reaches — and
// whether `/nouvelle` is swallowed by `/:id/edition` — is a property of the
// application's own routes, and a table rebuilt here would answer for itself.
const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
};

const OFFER_SCREENS = [
  { path: '/recruteur/offres', heading: 'Vos offres' },
  { path: '/recruteur/offres/nouvelle', heading: 'Nouvelle offre' },
  { path: '/recruteur/offres/12/edition', heading: 'Modifier l’offre' },
];

const headings = () =>
  screen.queryAllByRole('heading', { level: 1 }).map((node) => node.textContent);

describe('routes des offres recruteur', () => {
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

    findMine.mockResolvedValue(answer([]));
    // Never settled: the edition screen paints its title before the offer
    // arrives, so the routing questions asked here need no offer payload — and
    // borrowing one would tie these specs to the form's mapping.
    findOneById.mockReturnValue(
      new Promise(() => {}) as ReturnType<typeof offerControllerFindOneById>,
    );
  });

  it.each(OFFER_SCREENS)(
    'affiche $heading sur $path pour un recruteur',
    async ({ path, heading }) => {
      authenticateAs('recruiter');
      renderAt(path);

      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    },
  );

  // The redirect is read off the router rather than off whatever the landing
  // screen paints: where the visitor ends up is this spec's subject, and the
  // markup of the connection and splash screens is not.
  it.each(OFFER_SCREENS)(
    'renvoie un visiteur anonyme de $path vers la connexion',
    async ({ path, heading }) => {
      const router = renderAt(path);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/connexion');
      });
      expect(headings()).not.toContain(heading);
    },
  );

  it.each(OFFER_SCREENS)(
    'renvoie un candidat connecté de $path vers l’accueil',
    async ({ path, heading }) => {
      authenticateAs('candidate');
      const router = renderAt(path);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/');
      });
      expect(headings()).not.toContain(heading);
    },
  );

  // A guard that redirects while the session is still being read ejects a
  // recruiter who simply refreshed the page, before anyone could know who they
  // are.
  it.each(OFFER_SCREENS)(
    'ne redirige pas depuis $path tant que la session est en cours de vérification',
    ({ path }) => {
      vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
      const router = renderAt(path);

      expect(router.state.location.pathname).toBe(path);
      expect(headings()).toEqual([]);
    },
  );

  // `/nouvelle` and `/:id/edition` share a prefix and the same screen, so the
  // only thing that tells them apart is which one the router picks — and that
  // ranking is react-router's, not ours.
  it('ne laisse pas la route d’édition capturer la création', async () => {
    authenticateAs('recruiter');
    renderAt('/recruteur/offres/nouvelle');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nouvelle offre' }),
    ).toBeInTheDocument();
    expect(headings()).not.toContain('Modifier l’offre');
    expect(findOneById).not.toHaveBeenCalled();
  });

  it('passe l’identifiant de l’URL à l’écran d’édition', async () => {
    authenticateAs('recruiter');
    renderAt('/recruteur/offres/12/edition');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Modifier l’offre' }),
    ).toBeInTheDocument();
    expect(findOneById).toHaveBeenCalledWith(12);
  });
});
