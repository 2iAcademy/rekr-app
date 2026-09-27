import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { offerControllerFindOneById, offerControllerUnlike } from '@/api/generated';
import { routes } from '@/router';

vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
  authControllerLogout: vi.fn(),
  authControllerSignup: vi.fn(),
  candidateProfileControllerCreate: vi.fn(),
  candidateProfileControllerUpdate: vi.fn(),
  companyControllerCreate: vi.fn(),
  companyControllerUpdateMine: vi.fn(),
  jobFamilyControllerFindAll: vi.fn().mockResolvedValue({ data: [] }),
  likeControllerFindSent: vi.fn().mockResolvedValue({ data: [] }),
  likeControllerFindReceived: vi.fn().mockResolvedValue({ data: [] }),
  matchControllerFindMine: vi.fn().mockResolvedValue({ data: [] }),
  offerControllerCreate: vi.fn(),
  offerControllerFindFeed: vi.fn().mockResolvedValue({ data: [] }),
  offerControllerFindMine: vi.fn().mockResolvedValue({ data: [] }),
  offerControllerFindOneById: vi.fn(),
  offerControllerLike: vi.fn(),
  offerControllerPass: vi.fn(),
  offerControllerUnlike: vi.fn(),
  sectorControllerFindAll: vi.fn(),
}));

const likedOffer = {
  id: 30,
  title: 'Data Analyst',
  description: null,
  city: 'Lyon',
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
  salaryMin: 45000,
  salaryMax: 55000,
  createdAt: '2026-02-01T00:00:00.000Z',
  company: { id: 9, name: 'Orbit', logo: null, size: 'PME', description: null, city: 'Lyon' },
  tags: [],
  liked: true,
};

const authenticateAsCandidate = () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 1,
        email: 'a@rekr.fr',
        role: 'user',
        userType: 'candidate',
        isActive: true,
        hasProfile: true,
      },
    }),
  } as unknown as Response);
};

const renderAt = (entry: InitialEntry) => {
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
};

const url = (router: ReturnType<typeof renderAt>) =>
  `${router.state.location.pathname}${router.state.location.search}`;

const openedFrom = (from: unknown): InitialEntry => ({ pathname: '/offres/30', state: { from } });

describe('retour depuis le détail d’une offre', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    authenticateAsCandidate();
    vi.mocked(offerControllerFindOneById).mockResolvedValue({
      data: likedOffer,
    } as unknown as Awaited<ReturnType<typeof offerControllerFindOneById>>);
    vi.mocked(offerControllerUnlike).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof offerControllerUnlike>>,
    );
  });

  it('revient à l’onglet d’origine après le retrait du like', async () => {
    const user = userEvent.setup();
    const router = renderAt(openedFrom('/matches?onglet=mes-likes'));

    await user.click(await screen.findByRole('button', { name: 'Retirer mon like' }));

    await waitFor(() => expect(url(router)).toBe('/matches?onglet=mes-likes'));
  });

  it('revient au feed quand l’écran a été ouvert sans origine', async () => {
    const user = userEvent.setup();
    const router = renderAt('/offres/30');

    await user.click(await screen.findByRole('button', { name: 'Retirer mon like' }));

    await waitFor(() => expect(url(router)).toBe('/candidat/offres'));
  });

  /**
   * Le `state` de navigation vient du client : il peut porter n'importe quoi,
   * y compris une destination hors du site. Seul un chemin interne est suivi.
   */
  it.each([
    ['une URL absolue', 'https://evil.example'],
    ['une URL sans protocole', '//evil.example'],
    ['un chemin échappé', '/\\evil.example'],
    ['un chemin relatif', 'matches'],
    ['autre chose qu’une chaîne', 42],
  ])('ignore une origine qui est %s', async (_, from) => {
    const user = userEvent.setup();
    const router = renderAt(openedFrom(from));

    await user.click(await screen.findByRole('button', { name: 'Fermer' }));

    await waitFor(() => expect(url(router)).toBe('/candidat/offres'));
  });
});
