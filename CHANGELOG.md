# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The retrospective entries below are based on the published GitHub release notes.

## [Unreleased]

## [1.3.0] - 2026-10-28

Source: [v1.3.0 release notes](https://github.com/2iAcademy/rekr-app/releases/tag/v1.3.0).

### Added

- Architecture overview and diagrams (#341).
- Architecture decision records (#318).
- Action plan (#317) and tech debt register (#324).
- Changelog (#326) and contributing guide (#328).

### Changed

- Backend logs are written as JSON, one object per line, with the request ID set by Caddy (#325).

### Fixed

- Production deploys run again when the image scan is skipped on main (#348).

### Security

- gitleaks scans the git history for secrets on every run (#327).
- Trivy scans the backend, migrate and web images, and Hadolint lints the Dockerfiles (#342, #343).
- 20 Dependabot updates, including body-parser, undici, nodemailer and ip-address.

## [1.2.0] - 2026-10-28

Source: [v1.2.0 release notes](https://github.com/2iAcademy/rekr-app/releases/tag/v1.2.0).

### Added

- Skip link, reduced motion and focus handling in the multi-step forms (#276).
- A browser test of the match journey and a one-minute k6 load test in CI (#287).
- A coverage threshold on the backend services (#281).
- Backend logs go to Sentry Logs (#294), and Sentry knows which version is deployed (#298).
- Moderation procedure for an account or an offer (#285).
- API metrics and a local monitoring stack (Prometheus, Grafana, Loki, Alloy), development only (#272).
- Swipe decisions are published to Kafka and analysed with Spark, as a development-only data prototype (#299).

### Fixed

- The 11 issues found by the RGAA accessibility audit (#283).
- Brevo is listed among the processors in the privacy policy (#278).

### Security

- New passwords need at least 12 characters (#273).
- `/api/metrics` is blocked at Caddy (#296).
- 3 Dependabot updates.

## [1.1.0] - 2026-10-14

Source: [v1.1.0 release notes](https://github.com/2iAcademy/rekr-app/releases/tag/v1.1.0).

### Added

- Nightly backups of the database and uploads, with a restore test (#254).

### Changed

- New interface built around a single violet accent (#193).
- Swipe feedback confirms every like or pass, moves the card toward the corresponding side, and reports failed likes (#243).
- Renamed the "Matchs" menu to "Activité", since it contains both likes and matches (#243).
- Reduced the API image size (#255).
- Translated the README into English (#271).

### Fixed

- The backend initializes Elasticsearch when the backend starts first and catches up offers missed while the search engine was unavailable (#241; closes #230 and #227).
- Candidate photos are displayed on the recruiter side (#242).
- The session hint survives a transient refresh failure (#270).
- Resolved Lighthouse SEO and best-practices findings (#269).

### Security

- Applied API runtime dependency patches, including proxy-addr (#253), plus 16 Dependabot updates.

## [1.0.0] - 2026-10-14

First public version of Rekr on rekr.tech.

Source: [v1.0.0 release notes](https://github.com/2iAcademy/rekr-app/releases/tag/v1.0.0).

### Added

- Candidate sign-up, login, and a four-step profile onboarding flow.
- Offer feed ranked by Elasticsearch, with a PostgreSQL fallback when the search engine is unavailable.
- Like and pass actions on offers, separate likes and matches tabs, and the ability to unmatch.
- Five-step recruiter company-profile and job-offer flow.
- Recruiter access to candidates who liked an offer; a reciprocal like creates a match.
- Chat between matched users through Stream.
- Account export and deletion for GDPR support.
- CI/CD deployment pipeline to the VPS, with manual approval before each deployment.
- Health endpoints at `/api/health` and `/api/health/search`.
- Deployment guide (`docs/deploiement-vps.md`) and incident runbook (`docs/ops/runbook.md`).

### Security

- Stronger password rules.

[Unreleased]: https://github.com/2iAcademy/rekr-app/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/2iAcademy/rekr-app/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/2iAcademy/rekr-app/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/2iAcademy/rekr-app/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/2iAcademy/rekr-app/releases/tag/v1.0.0
