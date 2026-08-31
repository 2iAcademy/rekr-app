import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { offerControllerFindApplicants, type OfferApplicantDto } from '@/api/generated';
import { routes } from '@/router';
import { anApplicant } from './fixtures';

vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
  authControllerLogout: vi.fn(),
  authControllerSignup: vi.fn(),
  offerControllerFindApplicants: vi.fn(),
  offerControllerLikeApplicant: vi.fn(),
  offerControllerFindMine: vi.fn().mockResolvedValue({ data: [] }),
  sectorControllerFindAll: vi.fn(),
}));

const findApplicants = vi.mocked(offerControllerFindApplicants);

const answer = (data: OfferApplicantDto[]) =>
  ({ data, status: 200, headers: new Headers() }) as unknown as Awaited<
    ReturnType<typeof offerControllerFindApplicants>
  >;

const authenticateAs = (userType: 'candidate' | 'recruiter') => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: { id: 1, email: 'a@rekr.fr', role: 'user', userType, isActive: true, hasProfile: true },
    }),
  } as unknown as Response);
};

/**
 * `previousPath` seeds an entry underneath the one rendered, which is what makes
 * a pushed correction distinguishable from a replaced one.
 */
const renderAt = (path: string, previousPath?: string) => {
  const entries = previousPath === undefined ? [path] : [previousPath, path];
  const router = createMemoryRouter(routes, {
    initialEntries: entries,
    initialIndex: entries.length - 1,
  });

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
};

type TestRouter = ReturnType<typeof renderAt>;

const goBack = (router: TestRouter) =>
  act(async () => {
    await router.navigate(-1);
  });

const profileParam = (router: TestRouter): string | null =>
  new URLSearchParams(router.state.location.search).get('profil');

const APPLICANTS_PATH = '/recruteur/offres/12/candidats';

describe('OfferApplicantsRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    findApplicants.mockResolvedValue(answer([anApplicant]));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
  });

  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderAt(APPLICANTS_PATH);

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('écarte un candidat de l’écran', async () => {
    authenticateAs('candidate');
    const router = renderAt(APPLICANTS_PATH);

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('affiche les candidats intéressés à un recruteur', async () => {
    authenticateAs('recruiter');
    renderAt(APPLICANTS_PATH);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Candidats intéressés' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(findApplicants).toHaveBeenCalledWith(12, expect.anything()));
  });

  // Un identifiant d'offre illisible n'est pas un écran à formuler : il n'y a
  // pas d'offre à montrer, donc retour à la liste.
  it('renvoie vers la liste des offres quand l’identifiant n’est pas un nombre', async () => {
    authenticateAs('recruiter');
    const router = renderAt('/recruteur/offres/abc/candidats');

    await waitFor(() => expect(router.state.location.pathname).toBe('/recruteur/offres'));
    expect(findApplicants).not.toHaveBeenCalled();
  });

  it('ouvre le profil par le paramètre d’URL, et le referme au retour arrière', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    const router = renderAt(APPLICANTS_PATH);

    await user.click(await screen.findByRole('button', { name: 'Voir le profil de Camille' }));

    expect(profileParam(router)).toBe('1');
    expect(await screen.findByRole('region', { name: 'Profil de Camille' })).toBeInTheDocument();

    // Poussé, pas remplacé : le bouton retour du navigateur doit refermer le
    // profil plutôt que quitter l'écran.
    await goBack(router);

    expect(profileParam(router)).toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Profil de Camille' })).not.toBeInTheDocument(),
    );
  });

  it('referme le profil sans laisser d’entrée qui le rouvre', async () => {
    const user = userEvent.setup();
    authenticateAs('recruiter');
    const router = renderAt(APPLICANTS_PATH, '/recruteur/offres');

    await user.click(await screen.findByRole('button', { name: 'Voir le profil de Camille' }));
    await user.click(await screen.findByRole('button', { name: 'Retour à la liste' }));

    expect(profileParam(router)).toBeNull();

    // La fermeture remplace l'entrée que l'ouverture avait poussée : un retour
    // arrière ne doit donc pas rouvrir le profil que l'on vient de fermer.
    await goBack(router);

    expect(profileParam(router)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Profil de Camille' })).not.toBeInTheDocument();
  });

  it.each(['0', 'abc', ' 1 ', ''])('nettoie un paramètre de profil illisible (%s)', async (raw) => {
    authenticateAs('recruiter');
    const router = renderAt(`${APPLICANTS_PATH}?profil=${raw}`);

    await waitFor(() => expect(profileParam(router)).toBeNull());
  });
});
