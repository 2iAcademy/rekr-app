import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:3001/api';
const PASSWORD = 'Rekr-e2e-parcours-2026';
const run = Date.now().toString(36);

async function signup(request: APIRequestContext, email: string, userType: string) {
  const response = await request.post(`${API}/auth/signup`, {
    data: { email, password: PASSWORD, userType, acceptTerms: true },
  });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

async function post(request: APIRequestContext, path: string, token: string, data: object) {
  const response = await request.post(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function referenceId(request: APIRequestContext, path: string, token: string, name: string) {
  const response = await request.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const items = (await response.json()) as { id: number; label: string }[];
  const item = items.find((candidate) => candidate.label === name);
  expect(item, `${name} in ${path}`).toBeDefined();
  return item!.id;
}

async function signin(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('un like réciproque crée un match visible des deux côtés', async ({ browser, request }) => {
  const candidateEmail = `e2e.candidat.${run}@rekr.test`;
  const recruiterEmail = `e2e.recruteur.${run}@rekr.test`;
  const offerTitle = `Développeur·se TypeScript e2e ${run}`;

  // Arrange through the API: the onboarding screens have their own tests, and
  // this one is about the like and the match.
  const candidateToken = await signup(request, candidateEmail, 'candidate');
  const recruiterToken = await signup(request, recruiterEmail, 'recruiter');
  const informatique = await referenceId(request, '/job-families', candidateToken, 'Informatique');
  const numerique = await referenceId(
    request,
    '/sectors',
    recruiterToken,
    'Informatique & Numérique',
  );

  await post(request, '/candidate-profiles', candidateToken, {
    firstName: 'Camille',
    lastName: 'Test',
    desiredJobTitle: 'Développeuse TypeScript',
    city: 'Lyon',
    postalCode: '69001',
    contractTypes: ['CDI'],
    experienceLevel: 'CONFIRME',
    availability: 'IMMEDIATE',
    remotePolicy: 'HYBRID',
    mobilityRadiusKm: 30,
    mobilityNationwide: false,
    salaryMin: 40000,
    salaryMax: 50000,
    skills: ['TypeScript', 'React'],
    jobFamilyIds: [informatique],
  });
  await post(request, '/companies', recruiterToken, {
    firstName: 'Paul',
    lastName: 'Test',
    jobTitle: 'Recruteur',
    name: `Entreprise e2e ${run}`,
    size: 'PME',
    sectorId: numerique,
    city: 'Lyon',
    postalCode: '69001',
  });
  const offer = (await post(request, '/offers', recruiterToken, {
    title: offerTitle,
    status: 'open',
    jobFamilyId: informatique,
    description: 'Offre créée par le test de bout en bout du parcours de match.',
    city: 'Lyon',
    postalCode: '69001',
    contractType: 'CDI',
    minExperienceLevel: 'CONFIRME',
    remotePolicy: 'HYBRID',
    salaryMin: 40000,
    salaryMax: 50000,
    skills: ['TypeScript', 'React'],
  })) as { id: number };

  // The candidate finds the offer in the feed and likes it. On a database that
  // already holds offers it may not come first: the others are passed.
  const candidate = await browser.newPage();
  await signin(candidate, candidateEmail);
  await expect(candidate).toHaveURL(/\/candidat\/offres/);
  const card = candidate.getByRole('heading', { level: 2 }).first();
  await expect(card).toBeVisible();
  for (let i = 0; i < 50 && (await card.textContent()) !== offerTitle; i++) {
    await candidate.getByRole('button', { name: 'Passer' }).click();
  }
  await expect(card).toHaveText(offerTitle);
  await candidate.getByRole('button', { name: "Ça m'intéresse" }).click();
  await expect(card).not.toHaveText(offerTitle);

  // The recruiter sees her among the interested candidates and answers.
  const recruiter = await browser.newPage();
  await signin(recruiter, recruiterEmail);
  await expect(recruiter).toHaveURL(/\/recruteur\/offres/);
  await recruiter.goto(`/recruteur/offres/${offer.id}/candidats`);
  await recruiter.getByRole('button', { name: "Ça m'intéresse : Camille" }).click();
  await expect(recruiter.getByRole('heading', { level: 1 })).toHaveText(
    'Camille Test a aussi retenu votre profil',
  );

  // The match is on both sides.
  await recruiter.goto('/matches');
  await expect(recruiter.getByText('Camille').first()).toBeVisible();
  await candidate.goto('/matches');
  await expect(candidate.getByText(`Entreprise e2e ${run}`).first()).toBeVisible();
});
