# Contributing to Rekr

This guide explains how to set up the monorepo, work on an issue, and submit a pull request. Commands below use Bash; on Windows, use WSL with Docker Desktop integration enabled.

## Local installation

Install Git, Docker with Docker Compose, and Node.js/npm for the root Git tooling. Use Node.js 24 for the backend and Node.js 22 for the frontend to match CI; the Docker images already supply those versions. Node.js 24 can be used to install the root tooling.

```bash
git clone https://github.com/2iAcademy/rekr-app.git
cd rekr-app
npm ci
```

The root `npm ci` installs Husky and lint-staged and runs the `prepare` script to enable Git hooks. Backend and frontend dependencies are installed separately in their Docker images.

The development Compose supplies defaults, so an environment file is optional. To customize a fresh checkout:

```bash
cp .env.example .env
```

Do not overwrite an existing `.env`. Set `APP_URL` to your frontend address (normally `http://localhost:8080`); the example currently uses port 8082. Keep secrets in ignored `.env` files, never in committed examples. Stream, SMTP and Sentry credentials are optional for the basic local stack; chat requires Stream credentials.

| File             | Used by                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Root `.env`      | Compose variable substitution. The container database host is `postgres`.                                                        |
| `backend/.env`   | Host-side backend and Prisma commands. Copy `backend/.env.example` if needed; use `localhost` and the published PostgreSQL port. |
| `clientApp/.env` | Host-side Vite configuration. Copy `clientApp/.env.example` if needed. Never put backend secrets in `VITE_` variables.           |

Keep database credentials consistent between the root configuration and host-side `DATABASE_URL`.

```bash
docker compose up -d --build backend frontend
docker compose ps
docker compose logs --tail 50 backend frontend
```

This starts the application and its PostgreSQL/Elasticsearch dependencies. The backend applies existing Prisma migrations at startup. Use the default addresses below unless you changed ports or added a local Compose override:

- Frontend: http://localhost:8080
- API: http://localhost:3001/api
- Swagger: http://localhost:3001/api/docs

For monitoring, see the root Compose services and the [README](README.md). The optional Kafka/HDFS/Spark prototype has its own [data guide](data/README.md). Do not start the legacy `docker/docker-compose.yml` stack alongside the root stack; they share ports.

To stop the local services without removing data, use `docker compose stop`. Avoid `down -v` unless you intend to delete the stack's persistent data.

### Dependencies and database changes

Use `npm ci` in `backend/` or `clientApp/` when running tooling on the host. Commit both `package.json` and its corresponding `package-lock.json` when changing dependencies.

The backend's anonymous `node_modules` volume can hide dependencies from a rebuilt image. After backend dependency changes:

```bash
docker compose up -d --build --renew-anon-volumes backend
```

The frontend uses a named dependency volume; rebuilding alone does not refresh its installed packages. With the frontend running, synchronize it with the lockfile and restart:

```bash
docker compose exec frontend npm ci
docker compose restart frontend
```

For an intentional Prisma schema change, use a development database and create a migration from `backend/`:

```bash
npx prisma migrate dev --name describe_the_change
npx prisma generate
```

Commit the schema and new migration together. To apply existing migrations, use `prisma migrate deploy`; do not generate a new migration just to install the project.

## Branches

Use `preprod` as the normal integration base. `main` is the release/deployment branch: pushes there can start the deployment pipeline after checks and environment approval. Release PRs to `main` should be coordinated with maintainers.

For a new task, start from an updated `preprod` with a clean working tree:

```bash
git switch preprod
git pull --ff-only origin preprod
git switch -c feature/gh309-add-contributing
```

Replace the example issue number and description with your task. If you already have a task branch, continue on it instead of creating another one.

Use a short, lowercase, hyphen-separated name with the issue number. Suggested prefixes are `feature/`, `fix/`, `docs/`, `test/` and `chore/`; for example, `fix/gh230-search-recovery`. These are contributor conventions, not a branch-name validator enforced by the current hooks.

## Commits

Keep commits focused and describe the change clearly. Follow the repository's typed-message style, preferably:

```text
docs(gh#309): add contribution guide
feat(gh#215): publish swipe events
fix(gh#230): recover search indexing after an outage
```

Use `feat`, `fix`, `docs`, `test`, `refactor` or `chore` as appropriate. Include the issue reference when available. The current repository has no commit-message hook enforcing this syntax.

Review `git diff` and stage only the intended files before committing. Include relevant tests and documentation with functional changes.

## Husky hooks

The hook definitions are in [.husky/](.husky/), with staged-file rules in [lint-staged.config.mjs](lint-staged.config.mjs).

| Hook         | What it runs                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | lint-staged: ESLint fixes and Prettier for staged frontend TypeScript and backend TypeScript/JavaScript through Docker; host-side Prettier for matching JSON, Markdown, YAML and CSS files. |
| `pre-push`   | Frontend type-check, lint and unit tests, then backend lint and unit tests, inside the running Compose services. Stops on failure.                                                          |

Keep Docker running with `backend` and `frontend` started before committing application files or pushing. The pre-push hook runs both applications even for a documentation-only push. It does not replace CI: coverage, formatting, builds and E2E checks are additional checks.

If hooks are missing after installation, run `npm run prepare` at the root. If a hook fails, read the failing command, fix the problem and retry. Formatting hooks can modify staged files; review those changes. Do not routinely bypass hooks to push failing code.

## Checks to run before a PR

Run checks for the affected application. For changes shared by both applications, run both sets. Add tests for new behaviour, regressions and meaningful failure cases; the coverage rules are percentage thresholds, not a fixed number of tests per file.

### Backend

```bash
docker compose exec -T backend npm run lint:check
docker compose exec -T backend npm run format:check
docker compose exec -T backend npm run test:cov
docker build --target build -t rekr-backend:check ./backend
```

The Docker build target checks compilation without running the separate Sentry upload script. Backend coverage aggregates `*.service.ts` files: at least 80% lines, 80% statements, 75% functions and 70% branches, as defined in [check-service-coverage.mjs](backend/scripts/check-service-coverage.mjs).

### Frontend

```bash
docker compose exec -T frontend npm run type-check
docker compose exec -T frontend npm run lint:check
docker compose exec -T frontend npm run format:check
docker compose exec -T frontend npm run test:cov
docker compose exec -T frontend npm run build
```

The areas configured in [vitest.config.ts](clientApp/vitest.config.ts) require at least 80% statements, branches, functions and lines. Run the full coverage suite to evaluate those thresholds; a filtered test run is useful during development but cannot establish coverage of the other areas. Keep thresholds intact when adding tests.

For automatic fixes, both applications provide `npm run lint` and `npm run format`. Review the resulting diff.

### Backend E2E: use a separate database

Backend E2E tests truncate tables between tests. They use `TEST_DATABASE_URL`, and the database name must contain `test`. Never point them at the application or production database.

With the default local PostgreSQL credentials, create the dedicated database once:

```bash
docker compose exec postgres createdb -U postgres rekr_test
```

If it already exists, reuse it. Adjust the user, password and URL together if you customized PostgreSQL. Apply migrations to that database, then run the suite:

```bash
docker compose exec -T -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/rekr_test backend npx prisma migrate deploy
docker compose exec -T -e TEST_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/rekr_test backend npm run test:e2e
```

These environment overrides apply only to each command, not to the running application's configuration.

### Browser tests

For changes to user journeys, run the Playwright tests against your local application. They create their own test accounts and records.

```bash
cd e2e
npm ci
npx playwright install chromium
E2E_BASE_URL=http://localhost:8080 E2E_API_URL=http://localhost:3001/api npx playwright test
cd ..
```

On Linux, install browser system dependencies if Playwright requests them. For load testing, follow [loadtest/compose.yml](loadtest/compose.yml) and the [README](README.md); use a disposable local stack, never production.

CI is defined in [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml). Review the actual PR checks, including code analysis when configured; passing local hooks alone does not guarantee a green PR.

## Issues and the User Story template

Before starting, check existing issues to avoid duplicate work. Open [a new issue](https://github.com/2iAcademy/rekr-app/issues/new/choose) and select **User Story**. Blank issues are disabled.

The form in [.github/ISSUE_TEMPLATE/user_story.yml](.github/ISSUE_TEMPLATE/user_story.yml) requires:

- **Type:** Fonctionnalité, Bug or Technique.
- **User Story:** who needs the change, what they need and why.
- **Critères d'acceptation (Definition of Done):** verifiable completion criteria.
- **Priorité (MoSCoW):** Must, Should, Could or Won't have.

Use the `[US]` title prefix and a specific description. For a bug, include reproduction steps, expected and actual behaviour, and relevant environment details in the story. Remove secrets and personal data from logs or screenshots.

## Opening a pull request

1. Review the diff, run the relevant checks and commit the intended changes.
2. Push your task branch: `git push -u origin HEAD`. Husky runs the pre-push checks.
3. Open a PR against `preprod`, unless maintainers explicitly requested a different base. A PR to `preprod` does not deploy to production.
4. Give the PR a clear title and describe the problem, resulting behaviour and validation. Link the issue with `Closes #309` (using your actual issue number); verify issue closure when the change reaches the default branch.
5. Include screenshots for visible UI changes and explain any migrations, new environment variables or setup steps.
6. Request review, address comments, and wait for required checks and approvals before merging. Use a draft PR if work is incomplete.

There is currently no dedicated PR template file. Use this short structure in the PR description:

```markdown
## Changes

Describe the problem and what the change does.

Closes #<issue-number>

## Validation

- Commands run and results.
- Manual verification or screenshots when relevant.

## Setup notes

Document migrations or configuration changes, or write "None".
```

Keep the PR scoped to its issue. Update documentation when setup or behaviour changes, and add notable release-facing changes to `CHANGELOG.md` under `Unreleased` when that file is present on your branch.
