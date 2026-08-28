import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
 *
 * A browser-level suite (Playwright, §10 of docs/tests-frontend.md) is a
 * separate concern: it needs browser images, a CI job and the real backend.
 */
type User = ReturnType<typeof userEvent.setup>;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const recruiter = {
  id: 1,
  email: 'recruteur@rekr.fr',
  role: 'user',
  userType: 'recruiter',
  isActive: true,
  hasProfile: false,
};

const fetchMock = vi.fn();

const route = (url: string): Response => {
  if (url.includes('/api/auth/refresh')) {
    return json(401, {});
  }
  if (url.includes('/api/auth/signup')) {
    return json(201, { accessToken: 'jeton-de-test', user: recruiter });
  }
  if (url.includes('/api/sectors')) {
    return json(200, [
      { id: 4, label: 'Informatique & Numérique' },
      { id: 9, label: 'Juridique' },
    ]);
  }
  if (url.includes('/api/cities')) {
    return json(200, [
      { name: 'Lyon', postalCode: '69003', latitude: 45.751578, longitude: 4.869577 },
    ]);
  }
  if (url.includes('/api/companies/mine')) {
    return json(200, {});
  }
  if (url.includes('/api/companies') || url.includes('/api/offers')) {
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

const signUpAsRecruiter = async (user: User) => {
  await user.click(await screen.findByRole('radio', { name: /Recruteur/ }));
  await user.type(await screen.findByLabelText('Email'), 'recruteur@rekr.fr');
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));
};

const completeWizard = async (user: User) => {
  await user.type(screen.getByLabelText('Prénom'), 'Julien');
  await user.type(screen.getByLabelText('Nom'), 'Lemaitre');
  await user.type(screen.getByLabelText('Poste / fonction'), 'Responsable RH');
  await user.click(screen.getByRole('button', { name: 'Continuer' }));

  await user.type(screen.getByLabelText('Nom de la société'), 'Rekr');
  await waitFor(() => expect(screen.getByLabelText('Secteur')).toBeEnabled());
  await user.selectOptions(screen.getByLabelText('Secteur'), '4');
  await user.click(await screen.findByRole('radio', { name: 'PME' }));
  await user.type(screen.getByRole('combobox', { name: 'Ville' }), 'lyon');
  await user.click(await screen.findByRole('option', { name: 'Lyon (69003)' }));
  await user.type(screen.getByLabelText('Site web (optionnel)'), 'https://rekr.fr');
  await user.click(screen.getByRole('button', { name: 'Continuer' }));

  await user.type(
    screen.getByLabelText('Présentation de la société'),
    'On construit le matching qui respecte les candidats.',
  );
  await user.click(screen.getByRole('button', { name: 'Continuer' }));

  await user.type(screen.getByLabelText('Titre du poste'), 'Développeur Front React');
  await user.type(screen.getByLabelText('Missions'), 'Construire les écrans du swipe.');
  await user.type(screen.getByLabelText('Compétences recherchées'), 'React, TypeScript{Enter}');
  await user.type(screen.getByLabelText('Avantages (optionnel)'), 'Mutuelle, RTT{Enter}');
  await user.click(screen.getByRole('button', { name: 'Continuer' }));

  await user.click(await screen.findByRole('radio', { name: 'CDI' }));
  await user.click(await screen.findByRole('radio', { name: 'Confirmé' }));
  await user.click(await screen.findByRole('radio', { name: 'Hybride' }));
  await user.type(screen.getByLabelText('Salaire minimum (€ brut / an)'), '45000');
  await user.type(screen.getByLabelText('Salaire maximum (€ brut / an)'), '55000');
  await user.click(screen.getByRole('button', { name: 'Publier mon offre' }));
};

describe('parcours recruteur de bout en bout', () => {
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

    await signUpAsRecruiter(user);
    expect(await screen.findByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();

    await completeWizard(user);

    /*
     * On the feed, not on the splash: completing the wizard is what makes the
     * account whole, so it is where the journey lands.
     */
    expect(await screen.findByRole('heading', { level: 1, name: 'Candidats' })).toBeInTheDocument();

    const company = callTo('/api/companies');
    expect(company.method).toBe('POST');
    expect(company.authorization).toBe('Bearer jeton-de-test');
    expect(company.body).toEqual({
      firstName: 'Julien',
      lastName: 'Lemaitre',
      jobTitle: 'Responsable RH',
      name: 'Rekr',
      sectorId: 4,
      size: 'PME',
      city: 'Lyon',
      postalCode: '69003',
      siteUrl: 'https://rekr.fr',
      description: 'On construit le matching qui respecte les candidats.',
    });

    const offer = callTo('/api/offers');
    expect(offer.method).toBe('POST');
    expect(offer.authorization).toBe('Bearer jeton-de-test');
    expect(offer.body).toEqual({
      title: 'Développeur Front React',
      description: 'Construire les écrans du swipe.',
      city: 'Lyon',
      postalCode: '69003',
      skills: ['React', 'TypeScript'],
      benefits: ['Mutuelle', 'RTT'],
      contractType: 'CDI',
      minExperienceLevel: 'CONFIRME',
      remotePolicy: 'HYBRID',
      salaryMin: 45000,
      salaryMax: 55000,
      status: 'open',
    });
  });

  it('conserve la saisie et aboutit au second essai quand l’offre échoue', async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/offers')
        ? Promise.resolve(json(500, { message: 'Internal Server Error' }))
        : Promise.resolve(route(url)),
    );
    render(
      <AuthProvider>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/inscription'] })} />
      </AuthProvider>,
    );

    await signUpAsRecruiter(user);
    expect(await screen.findByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
    await completeWizard(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de publier votre profil. Réessayez dans un instant.',
    );

    // The company was created by the first attempt, so the replayed call gets the
    // 409 the real backend raises. The wizard has to fall back to the update and
    // reach the offer anyway — the creation endpoint alone would drop the form.
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/companies') && !url.includes('/mine')
        ? Promise.resolve(json(409, { message: 'Recruiter already has a company' }))
        : Promise.resolve(route(url)),
    );
    await user.click(screen.getByRole('button', { name: 'Publier mon offre' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Candidats' })).toBeInTheDocument();
    const offerCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/offers'));
    expect(offerCalls).toHaveLength(2);

    const update = callTo('/api/companies/mine');
    expect(update.method).toBe('PATCH');
    expect(update.body).toMatchObject({ name: 'Rekr', jobTitle: 'Responsable RH', sectorId: 4 });
  });
});
