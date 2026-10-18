// Load test of the candidate path, the one the API serves most: read the feed,
// decide on an offer, now and then look at the likes and matches. A second,
// lighter scenario logs in, since bcrypt makes it the costliest single request.
//
// Run it against the throwaway stack described in loadtest/compose.yml, never
// against production: setup() creates a recruiter, 300 offers and 50 candidates.
//
//   k6 run loadtest/parcours.js                       (API on localhost:3101)
//   k6 run -e API=http://host:port/api loadtest/parcours.js
//
// CANDIDATES, OFFERS and MINUTES shorten it: the CI runs 10 candidates for one
// minute on every pull request, to follow the response times version by version.
import http from "k6/http";
import { check, sleep } from "k6";

const API = __ENV.API || "http://localhost:3101/api";
const PASSWORD = "Rekr-charge-parcours-2026";
const CANDIDATES = Number(__ENV.CANDIDATES || 50);
const OFFERS = Number(__ENV.OFFERS || 300);
const SECONDS = Number(__ENV.MINUTES || 5) * 60;
const run = Date.now().toString(36);

export const options = {
  setupTimeout: "5m",
  scenarios: {
    candidats: {
      executor: "ramping-vus",
      exec: "candidat",
      startVUs: 0,
      stages: [
        { duration: `${SECONDS / 5}s`, target: CANDIDATES },
        { duration: `${(SECONDS * 3) / 5}s`, target: CANDIDATES },
        { duration: `${SECONDS / 5}s`, target: 0 },
      ],
    },
    connexions: {
      executor: "constant-arrival-rate",
      exec: "connexion",
      rate: 1,
      timeUnit: "2s",
      duration: `${SECONDS}s`,
      preAllocatedVUs: 2,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:feed}": ["p(95)<500"],
    "http_req_duration{name:decision}": ["p(95)<500"],
    "http_req_duration{name:login}": ["p(95)<1000"],
  },
};

const json = (token) => ({
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});

function post(path, body, token, name) {
  const response = http.post(`${API}${path}`, JSON.stringify(body), {
    ...json(token),
    tags: { name },
  });
  if (response.status >= 300) {
    throw new Error(`${path} ${response.status} ${response.body}`);
  }
  return response.json();
}

function referenceId(path, token, label) {
  const items = http.get(`${API}${path}`, json(token)).json();
  return items.find((item) => item.label === label).id;
}

const signup = (email, userType) =>
  post(
    "/auth/signup",
    { email, password: PASSWORD, userType, acceptTerms: true },
    null,
    "setup",
  ).accessToken;

export function setup() {
  const recruiter = signup(`charge.recruteur.${run}@rekr.test`, "recruiter");
  const informatique = referenceId("/job-families", recruiter, "Informatique");
  const numerique = referenceId(
    "/sectors",
    recruiter,
    "Informatique & Numérique",
  );
  post(
    "/companies",
    {
      firstName: "Paul",
      lastName: "Charge",
      jobTitle: "Recruteur",
      name: `Entreprise charge ${run}`,
      size: "PME",
      sectorId: numerique,
      city: "Lyon",
      postalCode: "69001",
    },
    recruiter,
    "setup",
  );

  const levels = ["JUNIOR", "CONFIRME", "SENIOR"];
  const remote = ["ON_SITE", "HYBRID", "FULL_REMOTE"];
  for (let i = 0; i < OFFERS; i++) {
    post(
      "/offers",
      {
        title: `Offre de charge n°${i}`,
        status: "open",
        jobFamilyId: informatique,
        description: "Offre créée par le test de charge.",
        city: i % 2 ? "Lyon" : "Lyon 3e Arrondissement",
        postalCode: i % 2 ? "69001" : "69003",
        contractType: "CDI",
        minExperienceLevel: levels[i % 3],
        remotePolicy: remote[i % 3],
        salaryMin: 35000 + (i % 10) * 1000,
        salaryMax: 45000 + (i % 10) * 1000,
        skills: ["TypeScript", "React", "NestJS"].slice(0, 1 + (i % 3)),
      },
      recruiter,
      "setup",
    );
  }

  const candidates = [];
  for (let i = 0; i < CANDIDATES; i++) {
    const email = `charge.candidat.${i}.${run}@rekr.test`;
    const token = signup(email, "candidate");
    post(
      "/candidate-profiles",
      {
        firstName: "Camille",
        lastName: `Charge${i}`,
        desiredJobTitle: "Développeuse TypeScript",
        city: "Lyon",
        postalCode: "69001",
        contractTypes: ["CDI"],
        experienceLevel: levels[i % 3],
        availability: "IMMEDIATE",
        remotePolicy: remote[i % 3],
        mobilityRadiusKm: 30,
        mobilityNationwide: false,
        salaryMin: 40000,
        salaryMax: 50000,
        skills: ["TypeScript", "React"],
        jobFamilyIds: [informatique],
      },
      token,
      "setup",
    );
    candidates.push({ email, token });
  }
  return { candidates };
}

export function candidat(data) {
  const { token } = data.candidates[(__VU - 1) % data.candidates.length];
  const feed = http.get(`${API}/offers/feed?limit=20`, {
    ...json(token),
    tags: { name: "feed" },
  });
  check(feed, { "fil 200": (r) => r.status === 200 });
  const offers = feed.status === 200 ? feed.json() : [];

  if (offers.length > 0) {
    // One like in three, as on the deck where most cards are passed.
    const verb = __ITER % 3 === 0 ? "like" : "pass";
    const decision = http.post(`${API}/offers/${offers[0].id}/${verb}`, null, {
      ...json(token),
      tags: { name: "decision" },
    });
    check(decision, {
      "décision 2xx": (r) => r.status >= 200 && r.status < 300,
    });
  }

  if (__ITER % 5 === 0) {
    const sent = http.get(`${API}/likes/sent`, {
      ...json(token),
      tags: { name: "likes" },
    });
    check(sent, { "likes 200": (r) => r.status === 200 });
    const matches = http.get(`${API}/matches`, {
      ...json(token),
      tags: { name: "matches" },
    });
    check(matches, { "matchs 200": (r) => r.status === 200 });
  }

  // The time a person takes to read a card before deciding.
  sleep(1 + Math.random() * 2);
}

export function connexion(data) {
  const { email } = data.candidates[__ITER % data.candidates.length];
  const response = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    { ...json(null), tags: { name: "login" } },
  );
  check(response, {
    "connexion 200": (r) => r.status === 200 || r.status === 201,
  });
}
