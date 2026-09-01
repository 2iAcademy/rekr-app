import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { candidateProfileControllerFindMine, companyControllerFindMine } from '@/api/generated';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ProfileRoute } from './routes';

// The role sections load their own data, so their reads are stubbed here too:
// this spec is about which one gets mounted, not about what they display.
vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
  authControllerLogout: vi.fn(),
  authControllerSignup: vi.fn(),
  candidateProfileControllerFindMine: vi.fn(),
  candidateProfileControllerUpdate: vi.fn(),
  candidateProfileControllerReplacePicture: vi.fn(),
  candidateProfileControllerRemovePicture: vi.fn(),
  candidateProfileControllerReplaceCv: vi.fn(),
  candidateProfileControllerRemoveCv: vi.fn(),
  companyControllerFindMine: vi.fn(),
  companyControllerUpdateMine: vi.fn(),
  companyControllerReplaceLogo: vi.fn(),
  companyControllerRemoveLogo: vi.fn(),
  companyControllerReplaceCoverImage: vi.fn(),
  companyControllerRemoveCoverImage: vi.fn(),
  sectorControllerFindAll: vi.fn(),
  cityControllerSearch: vi.fn(),
}));

const findCandidateProfile = vi.mocked(candidateProfileControllerFindMine);
const findCompany = vi.mocked(companyControllerFindMine);

// A pending read parks each section on its loading state: enough to tell which
// one was mounted without rebuilding either section's fixture here.
const pendingReads = () => {
  findCandidateProfile.mockReturnValue(new Promise(() => {}));
  findCompany.mockReturnValue(new Promise(() => {}));
};

const authenticateAs = (userType: 'candidate' | 'recruiter', email = 'camille@rekr.fr') => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 1,
        email,
        role: 'user',
        userType,
        isActive: true,
        hasProfile: true,
      },
    }),
  } as unknown as Response);
};

// A local route table, not the application one: this spec is about the guards of
// `ProfileRoute` and what it renders. Where the router mounts it is locked by
// `src/router.test.tsx`. The catch-all turns any stray redirect into a visible
// landing spot instead of an unmatched-route error.
const renderProfile = () => {
  const router = createMemoryRouter(
    [
      { path: '/profil', element: <ProfileRoute /> },
      { path: '/connexion', element: <h1>Connexion</h1> },
      { path: '*', element: <h1>Ailleurs</h1> },
    ],
    { initialEntries: ['/profil'] },
  );

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
};

const profileHeading = () => screen.queryByRole('heading', { level: 1, name: 'Mon compte' });

describe('ProfileRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    pendingReads();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
  });

  it('affiche le profil d’un candidat connecté', async () => {
    authenticateAs('candidate');
    renderProfile();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mon compte' }),
    ).toBeInTheDocument();
    expect(screen.getByText('camille@rekr.fr')).toBeInTheDocument();
    expect(screen.getByText('Candidat')).toBeInTheDocument();
  });

  it('affiche le profil d’un recruteur connecté avec son libellé de rôle', async () => {
    authenticateAs('recruiter', 'sacha@acme.fr');
    renderProfile();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mon compte' }),
    ).toBeInTheDocument();
    expect(screen.getByText('sacha@acme.fr')).toBeInTheDocument();
    expect(screen.getByText('Recruteur')).toBeInTheDocument();
  });

  it('ne redirige plus vers un autre écran pour un utilisateur connecté', async () => {
    authenticateAs('candidate');
    const router = renderProfile();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mon compte' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ailleurs' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profil');
  });

  /*
   * L'attente porte sur l'appel lui-même, pas sur le titre de la page : le
   * heading appartient à `AccountPage` tandis que la requête part d'un effet de
   * la section montée en dessous. Attendre le premier pour conclure sur le
   * second est une course, que seule une machine chargée perd.
   */
  it('monte la section du candidat pour un candidat', async () => {
    authenticateAs('candidate');
    renderProfile();

    await waitFor(() => expect(findCandidateProfile).toHaveBeenCalled());

    expect(findCompany).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Ma société' })).not.toBeInTheDocument();
  });

  it('monte la section du recruteur pour un recruteur', async () => {
    authenticateAs('recruiter', 'sacha@acme.fr');
    renderProfile();

    await waitFor(() => expect(findCompany).toHaveBeenCalled());

    expect(findCandidateProfile).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Mon profil' })).not.toBeInTheDocument();
  });

  it('ne charge aucun profil tant que la session est anonyme', async () => {
    renderProfile();

    await screen.findByRole('heading', { name: 'Connexion' });

    expect(findCandidateProfile).not.toHaveBeenCalled();
    expect(findCompany).not.toHaveBeenCalled();
  });

  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(profileHeading()).not.toBeInTheDocument();
  });

  it('n’affiche rien tant que la session est en cours de vérification', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderProfile();

    expect(profileHeading()).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Connexion' })).not.toBeInTheDocument();
  });
});
