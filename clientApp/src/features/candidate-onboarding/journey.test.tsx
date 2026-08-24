import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { clearAccessToken } from '@/api/tokenStore';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { routes } from '@/router';

/**
 * End-to-end across the real front-end stack — router, AuthProvider, the orval
 * client and `customFetch` — with only `fetch` stubbed. The component tests mock
 * `@/api/generated`, so they never exercise what actually goes over the wire:
 * the serialised body, the URL, the method or the bearer header. This does.
 */
type User = ReturnType<typeof userEvent.setup>;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const candidate = {
  id: 1,
  email: 'candidat@rekr.fr',
  role: 'user',
  userType: 'candidate',
  isActive: true,
};

const fetchMock = vi.fn();

const route = (url: string): Response => {
  if (url.includes('/api/auth/refresh')) {
    return json(401, {});
  }
  if (url.includes('/api/auth/signup')) {
    return json(201, { accessToken: 'jeton-de-test', user: candidate });
  }
  if (url.includes('/api/cities')) {
    return json(200, [{ name: 'Lyon', postalCode: '69001', latitude: 45.758, longitude: 4.835 }]);
  }
  if (url.includes('/api/candidate-profiles/me')) {
    return json(200, {});
  }
  if (url.includes('/api/candidate-profiles')) {
    return json(201, {});
  }

  throw new Error(`Appel réseau inattendu : ${url}`);
};

const callTo = (path: string) => {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes(path));
  if (!call) {
    throw new Error(`Aucun appel vers ${path}`);
  }

  const [, init] = call as [string, RequestInit];

  return {
    method: init.method,
    body: JSON.parse(String(init.body)) as Record<string, unknown>,
    authorization: new Headers(init.headers).get('Authorization'),
  };
};

const signUpAsCandidate = async (user: User) => {
  await user.click(screen.getByRole('radio', { name: /Candidat/ }));
  await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));
};

const completeWizard = async (user: User) => {
  await user.type(screen.getByLabelText('Prénom'), 'Ada');
  await user.type(screen.getByLabelText('Nom'), 'Lovelace');
  await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'lyon');
  await user.click(await screen.findByRole('option', { name: 'Lyon (69001)' }));
  await user.click(screen.getByRole('button', { name: 'Continuer' }));

  await user.type(screen.getByLabelText('Poste recherché'), 'Développeuse Front React');
  await user.click(screen.getByRole('checkbox', { name: 'CDI' }));
  await user.click(screen.getByRole('checkbox', { name: 'Freelance' }));
  await user.click(screen.getByRole('radio', { name: 'Confirmé' }));
  await user.click(screen.getByRole('radio', { name: 'Sous quelques mois' }));
  await user.type(screen.getByLabelText('Disponible dans (mois)'), '3');
  await user.click(screen.getByRole('button', { name: 'Continuer' }));

  await user.click(screen.getByRole('radio', { name: 'Hybride' }));
  await user.click(screen.getByRole('radio', { name: 'Autour de ma ville' }));
  await user.type(screen.getByLabelText('Rayon de mobilité (km)'), '30');
  await user.type(screen.getByLabelText('Salaire minimum (€ brut / an)'), '45000');
  await user.type(screen.getByLabelText('Salaire maximum (€ brut / an)'), '55000');
  await user.click(screen.getByRole('button', { name: 'Continuer' }));

  await user.type(screen.getByLabelText('Compétences'), 'React, TypeScript{Enter}');
  await user.type(screen.getByLabelText('Langues (optionnel)'), 'Anglais{Enter}');
  await user.type(
    screen.getByRole('textbox', { name: 'À propos de moi' }),
    'Je construis des interfaces qui respectent leurs utilisateurs.',
  );
  await user.click(screen.getByRole('button', { name: 'Publier mon profil' }));
};

describe('parcours candidat de bout en bout', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearAccessToken();
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string) => Promise.resolve(route(url)));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('mène de l’inscription à la publication et envoie les bonnes requêtes', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <AuthProvider>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/inscription'] })} />
      </AuthProvider>,
    );

    await signUpAsCandidate(user);
    expect(await screen.findByText('Étape 1 sur 4')).toBeInTheDocument();

    await completeWizard(user);

    // Back on the splash: the journey completed.
    expect(await screen.findByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();

    const profile = callTo('/api/candidate-profiles');
    expect(profile.method).toBe('POST');
    expect(profile.authorization).toBe('Bearer jeton-de-test');
    expect(profile.body).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'Lyon',
      postalCode: '69001',
      desiredJobTitle: 'Développeuse Front React',
      contractTypes: ['CDI', 'FREELANCE'],
      experienceLevel: 'CONFIRME',
      availability: 'WITHIN_DELAY',
      availabilityDelayMonths: 3,
      remotePolicy: 'HYBRID',
      mobilityNationwide: false,
      mobilityRadiusKm: 30,
      salaryMin: 45000,
      salaryMax: 55000,
      skills: ['React', 'TypeScript'],
      languages: ['Anglais'],
      bio: 'Je construis des interfaces qui respectent leurs utilisateurs.',
    });
  }, 30_000);

  // The profile was created by the first attempt, so the replayed call gets the
  // 409 the real backend raises. The wizard has to fall back to the update —
  // the creation endpoint alone would drop the form.
  it('conserve la saisie et aboutit au second essai quand la création échoue', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/candidate-profiles')
        ? Promise.resolve(json(500, { message: 'Internal Server Error' }))
        : Promise.resolve(route(url)),
    );
    render(
      <AuthProvider>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/inscription'] })} />
      </AuthProvider>,
    );

    await signUpAsCandidate(user);
    expect(await screen.findByText('Étape 1 sur 4')).toBeInTheDocument();
    await completeWizard(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de publier votre profil. Réessayez dans un instant.',
    );

    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/candidate-profiles') && !url.includes('/me')
        ? Promise.resolve(json(409, { message: 'Candidate profile already exists' }))
        : Promise.resolve(route(url)),
    );
    await user.click(screen.getByRole('button', { name: 'Publier mon profil' }));

    expect(await screen.findByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();

    const update = callTo('/api/candidate-profiles/me');
    expect(update.method).toBe('PATCH');
    expect(update.body).toMatchObject({ firstName: 'Ada', skills: ['React', 'TypeScript'] });
  });
});
