# Metrics and logs: development demonstration

Monitoring is kept in the development environment for the school demonstration.

## Start and access

The initial Grafana username and password default to `admin` for local development. Optionally override them using `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` in the repository-root `.env`. Then run from the repository root:

```bash
docker compose up -d
```

| Service            | Local URL                         | Purpose                                         |
| ------------------ | --------------------------------- | ----------------------------------------------- |
| Rekr               | http://localhost:8080             | Use the app to generate API traffic.            |
| Backend metrics    | http://localhost:3001/api/metrics | Inspect the raw measurements exposed by NestJS. |
| Prometheus         | http://localhost:9090             | Query collected metrics and their history.      |
| Prometheus targets | http://localhost:9090/targets     | Verify that `rekr-backend` is `UP`.             |
| Grafana            | http://localhost:3000             | Visualize metrics and search backend logs.      |

Log in to Grafana with the configured initial credentials, or the password you subsequently chose in Grafana. Credentials and dashboards persist in its named volume; changing `.env` does not reset an existing user's password. Prometheus and Grafana host ports are bound to localhost.

## How the connection works

1. `MetricsService` registers Node.js process metrics and HTTP metrics using `prom-client`.
2. `MetricsMiddleware` records the final status and elapsed time when an HTTP response finishes.
3. `MetricsController` exposes the measurements at `/api/metrics`.
4. Prometheus scrapes `http://backend:3001/api/metrics` every 30 seconds, as configured in `docker/prometheus/prometheus.yml`.
5. Grafana queries its provisioned Prometheus data source at `http://prometheus:9090`.

The Docker service names `backend` and `prometheus` are used between containers. `localhost` inside a container refers to that container, not the host or another service.

Kafka is not needed for this flow. Prometheus stores numerical time series, not application log messages or stack traces.

## What we measure

The demonstration focuses on three dashboard indicators. Prometheus calculates them from the raw HTTP metrics exposed by the backend.

| Dashboard indicator               | Plain-English meaning                                          | Calculation over the last five minutes                                             |
| --------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| API traffic                       | How many completed requests the API handles per second.        | Rate of increase of `rekr_http_requests_total`, summed across routes and statuses. |
| Average API response time         | How long the server takes to finish a response, on average.    | Rate of increase of duration `_sum` divided by that of duration `_count`.          |
| API server error percentage (5xx) | What percentage of completed requests returned a server error. | Rate of 500–599 responses divided by the rate of all responses, multiplied by 100. |

For example, five server errors among 100 completed requests means 5%. Responses such as 400, 401 and 404 are included in total traffic but not in the server-error count. With no traffic, average duration and error percentage are undefined; a graph may show a gap.

### Raw measurements behind the panels

- `rekr_http_requests_total`: a counter of completed responses, labeled by method, route template and status code.
- `rekr_http_request_duration_seconds`: a histogram exposing cumulative `_bucket` series, total duration in seconds (`_sum`) and observation count (`_count`). The average panel uses `_sum` and `_count`; a p95 panel is not part of this demonstration.
- Default Node.js process metrics remain available: resident memory (RSS), accumulated CPU time, event-loop delay and garbage collection. These were used to verify the initial connection and are still collected alongside the HTTP metrics.

RSS describes RAM resident for the backend process, not the whole Docker stack or database size. Accumulated CPU time is not a CPU percentage by itself. One memory reading does not establish a leak; sustained growth under comparable load is more informative.

### Measurement boundaries

HTTP route labels use templates such as `/api/offers/:id`, rather than individual offer IDs. Requests to `/api/metrics` are excluded from HTTP traffic metrics; health checks are included. Requests disconnected before the response finishes are not counted by this implementation. Timing runs from the metrics middleware to response completion on the server; it does not include the user's full browser/network experience.

Counters reset when the backend process restarts. Prometheus retains previously collected history and `rate()` accounts for counter resets. Prometheus scrapes every 30 seconds; the five-minute query window smooths those samples and is not the collection frequency.

## Demonstration panels

In Grafana, select the **Prometheus** data source and use a **Time series** visualization. The provisioned data source is automatic; the shared **Rekr — API monitoring** dashboard is now provisioned from Git. Subsequent UI edits remain local until you export and commit them.

### API traffic — requests per second

```promql
sum(rate(rekr_http_requests_total{job="rekr-backend"}[5m]))
```

This is the average request rate over five minutes. Use requests/second as the panel unit. `rate()` needs at least two scrape samples.

### Average API response time — seconds

```promql
sum(rate(rekr_http_request_duration_seconds_sum{job="rekr-backend"}[5m]))
/
sum(rate(rekr_http_request_duration_seconds_count{job="rekr-backend"}[5m]))
```

Total measured duration divided by completed request count. Set the unit to seconds; Grafana can display small values as milliseconds. An average can hide a few slow requests.

### API server error percentage — percent (0–100)

```promql
100 *
(
  sum(rate(rekr_http_requests_total{job="rekr-backend",status_code=~"5.."}[5m]))
  or
  (0 * sum(rate(rekr_http_requests_total{job="rekr-backend"}[5m])))
)
/
sum(rate(rekr_http_requests_total{job="rekr-backend"}[5m]))
```

Five 5xx responses out of 100 completed requests means 5%. The fallback supplies a zero numerator when no 5xx series exists but total-traffic data does. Responses such as 400, 401 and 404 are included in total traffic but are not server errors. Set the unit to **Percent (0–100)**, minimum 0 and maximum 100.

With no traffic, average duration and error percentage are undefined and may show a gap. Missing scrape data can also produce gaps. Check `up{job="rekr-backend"}` separately: 1 means a successful scrape, not proof that every application feature is healthy.

## Quick demonstration

Generate a small amount of traffic from WSL/Linux:

```bash
for i in {1..30}; do
  curl -fsS http://localhost:3001/api/health > /dev/null
  sleep 1
done
```

Wait for the next scrape, then refresh Grafana. Traffic and duration should show activity, and server error percentage should be 0% if no 5xx responses occurred. The five-minute rate can be below one request per second because the window includes idle time. Use the app to generate traffic for other routes.

## Why this is not deployed to production

This is an intentional scope decision for the school project: demonstrate backend instrumentation, metric collection and dashboards locally, without adding another production service to operate.

- `compose.prod.yml` does not include Prometheus, Grafana, Loki or Alloy.
- The deployment script extracts the production Compose file and pulls release images. It does not deliver the monitoring configuration files mounted by the development stack.
- The production configuration documents a 2 GB VPS already running the API, PostgreSQL, Elasticsearch and Caddy. Adding monitoring needs a capacity review; current development limits are 256 MiB for Prometheus and 512 MiB for Grafana.
- A future production rollout would need private access, production credentials, persistent storage, configuration/dashboard delivery and a retention plan. These are outside this demonstration's scope.

**Development-only monitoring does not disable the endpoint in production.** The current NestJS metrics code has no development-only guard. If it is included in a production release, `/api/metrics` will exist there, and the current Caddy `/api/*` proxy rule can expose it publicly. Before that release, explicitly disable the feature in production or block external access to the endpoint. There is currently no production Prometheus/Grafana deployment collecting and displaying it in this repository's production configuration.

## Local maintenance

```bash
# Validate the scrape configuration and inspect service status.
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose ps backend prometheus grafana

# Reload the mounted Prometheus configuration by restarting the service.
docker compose restart prometheus

# Inspect errors.
docker compose logs --tail 50 backend prometheus grafana
```

Named volumes preserve Prometheus history and Grafana settings. Avoid `docker compose down -v` when you want to keep them: it also deletes other application volumes. Prometheus retains up to seven days or 1 GB of blocks, whichever limit is reached first; its WAL and other files require additional disk space.

## Application logs with Alloy and Loki

The development flow is **service logs → shared log volumes → Alloy → Loki → Grafana**. Backend, frontend development server, PostgreSQL and Elasticsearch server logs are collected.
Prometheus answers numerical questions (traffic, duration, 5xx percentage); Loki stores the messages that help explain an event. Kafka is not needed for either flow.

The backend command uses `tee` to keep stdout/stderr visible in `docker compose logs backend` and append it to `/var/log/rekr/backend.log`. Each service has its own log volume, mounted read-only by Alloy. Alloy has no Docker socket access. It removes terminal colors and normalizes JSON severity fields and recognized NestJS/Vite text prefixes into the `level` label. Messages without a recognized severity remain searchable with `level="unknown"`.

### One real example

After the backend successfully starts in development, `main.ts` emits one JSON message:

```json
{
  "level": "info",
  "event": "observability_demo",
  "service": "backend",
  "message": "Backend started: log collection example"
}
```

This is an actual startup log generated by your backend, explicitly included as a teaching example. It is not a request log, an error, or evidence that every feature is healthy. It is emitted once per application start, including watch-mode reloads, and not in production.

### View it in Grafana

1. Start the services: `docker compose up -d --build backend frontend postgres elasticsearch loki alloy grafana`.
2. If Grafana was already running when the data-source file was added, run `docker compose restart grafana`.
3. Open http://localhost:3000 → **Explore** → choose **Loki** (provisioned automatically).
4. Select **Last 15 minutes**, switch the query editor to **Code**, and run:

```logql
{service="backend", environment="development"} |= "observability_demo"
```

To see all collected backend output, use:

```logql
{service="backend", environment="development"}
```

To generate a fresh example, run `docker compose restart backend`, wait for startup, then rerun the query. Structured informational logs can be selected with `{service="backend", level="info"}`.

A dashboard panel is optional: open your dashboard, add a visualization, select **Loki**, paste the query, select the **Logs** visualization, and save it as **Backend logs**. Use the all-output query for everyday inspection, or the filtered query to demonstrate this example.

### Scope, storage and troubleshooting

The four application containers are collected; browser console events and the separate Kafka stack are not. Completed HTTP 5xx responses and failed Elasticsearch, SMTP and Stream Chat operations now have structured failure events. Successful requests and 4xx responses are not logged by this failure instrumentation. Avoid logging credentials, tokens, request bodies or personal information.

Loki stores its data in `loki_data` with seven-day retention (deletion is asynchronous, not a strict disk-size limit). Alloy stores its reading positions in `alloy_data` so it can resume after restarting. The source files in `backend_logs` and `frontend_logs` are append-only and are **not** covered by Loki retention; those two local demonstration files have no automatic rotation. PostgreSQL reuses seven weekday log files, and Elasticsearch uses its bundled rolling-file policy. Add rotation before continuous or production use. Monitoring still stays out of the production Compose deployment.

```bash
docker compose config --quiet
docker compose run --rm --no-deps alloy validate /etc/alloy/config.alloy
docker compose ps backend loki alloy grafana
docker compose logs --tail 50 alloy loki
curl -fsS http://localhost:3100/ready
```

If Explore is empty, check the time range and backend startup, then collector errors. Loki readiness alone does not prove log delivery. Do not delete all Compose volumes to troubleshoot: they also contain application data.

## Failed requests and external-service failures

Two real event types are now emitted as single-line JSON:

| Event                     | When it is recorded                                                              | Fields                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `http_request_failed`     | A backend response finishes with status 500–599, excluding the metrics endpoint. | `method`, route template, `status_code`, `duration_ms`, `request_id`                                                       |
| `external_service_failed` | An instrumented Elasticsearch, SMTP or Stream Chat operation throws/rejects.     | `dependency`, `operation`, `duration_ms`, safe `error_type`/`error_code`, and `request_id` when run inside an HTTP request |

The backend generates the request ID and returns it in the `X-Request-ID` response header. Match it across both events to connect a dependency failure with its failed HTTP response. Background operations have no request ID. These fields are parsed at query time; request IDs are not Loki stream labels.

A dependency failure can be recovered from (for example, search falls back to PostgreSQL), so it does not always produce a 5xx response. One request may fail several dependency operations. Do not add the two counts together as a total of failed requests. The dependency count is failed logical operations after SDK retries, not failed network attempts or unique outages. Stream channel synchronization is one logical operation; batch cleanup logs each rejected operation. An unconfigured integration is not a failed external call. PostgreSQL and frontend container logs are collected separately, but do not emit these backend failure events. Kafka and browser events are outside this instrumentation.

The new events omit raw error messages, stack traces, bodies, query strings, credentials and user data. They provide safe operational context; existing Sentry reporting is unchanged for deeper exception investigation. Existing application logs have not all been audited or converted (the local logging email sender still prints reset links), so use test data for the school demonstration.

### Add dashboard panels

Open your dashboard → **Add visualization** → **Loki**, then select **Code** in the query editor. Set the dashboard time range to **Last 15 minutes**.

**1. Failed HTTP requests — last 5 minutes**

Use a **Stat** visualization, query type **Instant**, unit **short**, decimals **0**:

```logql
sum(count_over_time({service="backend", level="error"} | json | __error__="" | event="http_request_failed" [5m])) or vector(0)
```

This is the number of logged completed 5xx responses in the last five minutes. It is a count, not a percentage; keep your existing Prometheus 5xx percentage panel.

**2. External failures by service — last 5 minutes**

Use **Time series**, query type **Range**, unit **short**, decimals **0**, and legend `{{dependency}}`:

```logql
sum by (dependency) (count_over_time({service="backend", level="error"} | json | __error__="" | event="external_service_failed" [5m]))
```

Each point counts failures in the preceding five minutes, grouped as `elasticsearch`, `smtp` or `stream_chat`. Overlapping five-minute windows mean you must not sum plotted points. No failures can produce an empty graph. A separate total **Stat** panel can use:

```logql
sum(count_over_time({service="backend", level="error"} | json | __error__="" | event="external_service_failed" [5m])) or vector(0)
```

**3. Failure details**

Use **Logs**, query type **Range**:

```logql
{service="backend", level="error"} | json | __error__="" | event=~"http_request_failed|external_service_failed"
```

Expand an entry to see its fields. To correlate one request, copy its ID and append `| request_id="PASTE_ID_HERE"`. Save the dashboard. Zero/no matching logs is not proof of health: a broken collector can also hide failures. Keep checking service readiness and the Prometheus target.

Query syntax: [Grafana Loki query editor](https://grafana.com/docs/grafana/latest/datasources/loki/query-editor/).

### Reproduce both failures safely in development

This temporarily stops local Elasticsearch, so search is degraded until you restart it. Do not run against production. From WSL, restore Elasticsearch even if the HTTP check fails:

```bash
(
  trap 'docker compose start elasticsearch' EXIT
  docker compose stop elasticsearch
  curl -i http://localhost:3001/api/health/search
)
```

The health endpoint should return 503 while Elasticsearch is stopped. After a few seconds, Loki should show an `external_service_failed` event for `elasticsearch` / `health_check` and an `http_request_failed` event for the same request ID. Wait for Elasticsearch to recover and verify `curl -i http://localhost:3001/api/health/search` returns 200 again. Avoid repeated requests: health probes themselves count as traffic and failure events.

## All four services in one Grafana view

| Loki `service` label | What is collected                                             | How it reaches a file                                                     |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `backend`            | NestJS output, HTTP 5xx and dependency failure events         | Existing `tee` command → `backend_logs`                                   |
| `frontend`           | Vite development server startup, warnings, build/proxy errors | `tee` → `frontend_logs`; Vite messages include explicit severity prefixes |
| `postgresql`         | PostgreSQL server startup, warnings and errors                | Native JSON logging → `postgres_logs`                                     |
| `elasticsearch`      | Elasticsearch's own server events                             | Native `ES_LOG_STYLE=file` → `elasticsearch_logs`                         |

These are application-container logs. The frontend container runs Vite; code executing in a user's browser logs to that browser, not the container. Browser exception reporting continues to use the existing Sentry integration. No browser log forwarding endpoint was added.

The common `level` label uses `info`, `warn`, `error`, `debug`, etc. PostgreSQL `LOG`/`NOTICE` become `info`, `WARNING` becomes `warn`, and `FATAL`/`PANIC` become `error`; original JSON/text is preserved. Recognized NestJS/Vite severity prefixes are normalized too. Unmarked npm/plugin output and some multiline continuation lines use `unknown`, rather than pretending their severity is known.

PostgreSQL's collector redirects its normal server messages into JSON files, so `docker compose logs postgres` will mainly show entrypoint/early startup messages. Consult Loki for subsequent server events. SQL statement logging is not enabled; logging of error statements is reduced with `log_min_error_statement=panic`. Database/server messages can still contain application data, so use school test data. Elasticsearch collection uses only `*_server.json`, avoiding duplicate plain-text files, compressed archives and query/audit logs. No database data volume or Docker socket is mounted in Alloy.

### Start after pulling these changes

```bash
docker compose up -d --build frontend postgres elasticsearch alloy
```

The frontend rebuild creates its writable log directory as the existing non-root `node` user. PostgreSQL and Elasticsearch restart to enable file logging; give them time to become healthy. Existing data volumes are retained. On an already-running stack, reload Alloy after editing its config with `docker compose restart alloy`. First file discovery takes a few seconds.

### Dashboard instructions

Open http://localhost:3000 → your dashboard → **Add visualization** → **Loki** → **Code**. Select **Last 15 minutes**.

**All application logs:** choose **Logs**, query type **Range**, paste:

```logql
{service=~"backend|frontend|postgresql|elasticsearch"}
```

Save as **Application logs**. Expand an entry to inspect `service` and `level`. This one panel is enough to demonstrate centralized collection.

**Warnings and errors:** duplicate the Logs panel and use:

```logql
{service=~"backend|frontend|postgresql|elasticsearch", level=~"warn|error"}
```

Save as **Warnings and errors**. An empty result simply means no matching messages in the selected period; check the all-logs panel and collector status too.

**One service:** use any of these in Explore or a separate Logs panel:

```logql
{service="frontend"}
{service="postgresql"}
{service="elasticsearch"}
```

Run each expression separately. Keep your existing backend failure panels: an Elasticsearch server error and a backend failed-call event describe different sides of a problem.

Optional **Time series** (Range query), legend `{{service}}`, to count error log entries per service in each trailing five-minute window:

```logql
sum by (service) (count_over_time({service=~"backend|frontend|postgresql|elasticsearch", level="error"}[5m]))
```

These are log-entry counts, not unique incidents, failed-request counts or percentages. One incident can create several entries. The shared dashboard is provisioned automatically. Additional UI-created dashboards remain in your local Grafana volume until exported and provisioned.

Configuration references: [PostgreSQL logging](https://www.postgresql.org/docs/18/runtime-config-logging.html), [Alloy log processing](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.process/).

## Shared dashboard: automatic provisioning

The saved **Rekr — API monitoring** dashboard (seven panels) is included in `docker/grafana/provisioning/dashboards/json/rekr-api-monitoring.json`. The provider file beside the `json` directory loads it automatically through the existing read-only provisioning mount. No manual import is needed.

After pulling the changes:

```bash
docker compose up -d --build
# If Grafana was already running, load the newly added provider:
docker compose restart grafana
```

Open http://localhost:3000/d/ads8zdb and log in. A fresh Grafana volume uses `admin` / `admin` unless overridden in `.env`; an existing volume keeps its current password. Your colleague sees the same seven panels and layout, filled with their own local metrics/logs, not your historical data. Quiet services may show no matching logs.

The exported dashboard keeps its UID, so your current dashboard URL stays the same. Its Prometheus and Loki references use the stable provisioned data-source UIDs. It uses Grafana's v2 dashboard resource format supported by the pinned Grafana image.

You can still edit and save panels in the UI (`allowUiUpdates: true`), but Grafana cannot write those changes into the read-only Git files. To share an update, export the dashboard as **V2 Resource** JSON and replace the checked-in JSON, keeping `metadata.name` as `ads8zdb` and data-source references as `prometheus`/`loki`. Keep only the portable metadata name, not server-specific IDs or timestamps. Commit and push that file. A later provisioning-file update overwrites local UI edits, so export wanted edits first. Removing the file does not automatically delete the saved dashboard (`disableDeletion: true`).

Reference: [Grafana dashboard provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/).
