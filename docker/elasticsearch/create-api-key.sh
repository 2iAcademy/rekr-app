#!/usr/bin/env sh
# Creates the backend's Elasticsearch API key and prints it, to be pasted into
# ELASTICSEARCH_API_KEY in the server's `.env`. Run once, from the repository
# root, with the production stack up:
#
#   sh docker/elasticsearch/create-api-key.sh
#
# The key is scoped to the offers index and carries no cluster privilege: it
# can check, create, delete, read and write `rekr-offers-*`, which is exactly
# what OfferSearchService does, and nothing else. The `elastic` superuser only
# authenticates this one call.
#
# Running it again creates another key; invalidate the old one afterwards
# (DELETE /_security/api_key with its id).
set -eu

cd "$(dirname "$0")/../.."

docker compose -f compose.prod.yml exec -T elasticsearch sh -c '
  curl -fsS -u "elastic:$ELASTIC_PASSWORD" \
    -X POST "http://localhost:9200/_security/api_key" \
    -H "Content-Type: application/json" \
    -d @-
' <<'JSON' | sed -n 's/.*"encoded":"\([^"]*\)".*/\1/p'
{
  "name": "rekr-backend",
  "role_descriptors": {
    "rekr-offers": {
      "cluster": [],
      "indices": [
        {
          "names": ["rekr-offers-*"],
          "privileges": ["view_index_metadata", "create_index", "delete_index", "read", "write"]
        }
      ]
    }
  }
}
JSON
