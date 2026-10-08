#!/usr/bin/env bash
# Writes the production .env from the variables of the current environment,
# where the CI has put the secrets and variables of its `production`
# environment. Called by .github/workflows/ci-cd.yml before the deploy.
#
#   scripts/ci/render-env.sh <output file>
#
# Fails before the server is touched when a required value is missing:
# compose.prod.yml checks the same names with `:?`, but only once the stack is
# already being replaced. .env.prod.example is the reference list.
#
# IMAGE_TAG is not written here: the server sets it to the commit it deploys.
set -euo pipefail

out="${1:?usage: render-env.sh <output file>}"

required=(
  DOMAIN POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB JWT_SECRET
  SMTP_HOST SMTP_USER SMTP_PASSWORD MAIL_FROM ELASTIC_PASSWORD
  STREAM_API_KEY STREAM_API_SECRET
  DEPLOY_HOST DEPLOY_USER DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS
)
written=(
  DOMAIN POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB JWT_SECRET
  SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASSWORD MAIL_FROM
  ELASTIC_PASSWORD ELASTICSEARCH_API_KEY ELASTICSEARCH_REINDEX_ON_STARTUP
  STREAM_API_KEY STREAM_API_SECRET
  SENTRY_DSN SENTRY_TRACES_SAMPLE_RATE
)

missing=()
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || missing+=("$name")
done
if ((${#missing[@]} > 0)); then
  echo "::error::Missing in the production environment: ${missing[*]}" >&2
  exit 1
fi

# Single quotes keep every value literal for Compose: no `$` interpolation
# inside a password. They cannot be escaped there, so a value holding one, or
# a line break, is refused instead.
umask 077
: >"$out"
for name in "${written[@]}"; do
  value="${!name:-}"
  if [[ "$value" == *"'"* || "$value" == *$'\n'* ]]; then
    echo "::error::$name holds a quote or a line break" >&2
    exit 1
  fi
  [[ -n "$value" ]] || continue
  printf "%s='%s'\n" "$name" "$value" >>"$out"
done
