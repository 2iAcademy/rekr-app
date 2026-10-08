# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences share one app:

- **Candidates** — every profile, from junior to expert, across service trades. Contract types range from CDI to alternance, stage, freelance and intérim. They browse offers on their phone, in short sessions.
- **Recruiters** — people hiring for companies of every size, from TPE to grande entreprise. They publish offers, then review the candidates who liked them.

## Product Purpose

Rekr connects candidates and companies of every size through mutual interest. Success is a match: both sides said yes, and the conversation can start.

## Positioning

- **Mutual match.** Nobody sends an application into the void. A candidate likes an offer, the recruiter likes the candidate back, and only then do they meet.
- **Mobile speed.** Deciding on an offer or a profile takes seconds, from a phone.

## Operating Context

- Mobile-first PWA; tablet at 768px, desktop sidebar past 1440px.
- French-language interface throughout.
- Candidate journey: signup → onboarding wizard (job family, contract, experience, mobility, salary, CV) → offer feed (like / pass, keyboard and swipe) → offer detail → matches → profile.
- Recruiter journey: signup → onboarding wizard (company, sector, size: TPE, PME, ETI or grande entreprise) → offers list → offer form (rich text, salary range, city) → applicants per offer → candidate detail → matches → profile.
- A match screen celebrates the mutual like; either side can end a match afterwards.

## Capabilities and Constraints

- Stack: React 19, Vite, Tailwind 4, shadcn / Base UI components, lucide icons, sonner toasts.
- The redesign keeps every existing feature, route and API contract; only the visual and interaction layer changes.
- Validation for the frontend is `npm run build`, `npm run lint:check`, `npm run format:check`, `npm run test:cov` in `clientApp/`.

## Brand Commitments

- The name **Rekr** stays.
- Standing preference (2026-09-21): the category standard, played straight — no metaphor world. Craft bar: Malt (clear info rows, trust, pro tone), alongside Welcome to the Jungle and Hinge.
- One accent for the whole product, ink violet `#5b3fd6`. Candidates and recruiters share the same palette; the role reads from navigation and content, not colour.

## Evidence on Hand

No testimonials, customer logos or usage figures exist. The splash can show a weekly match count from the API when it is above zero; nothing else may be claimed.

## Product Principles

1. A decision should take one glance: the card carries what matters for yes or no, nothing more.
2. Mutuality is the promise — the match moment is the emotional peak of the product.
3. A small company must look as credible as a large one on the same screen.
4. Both audiences are equals; neither side feels like the "customer" of the other.
