# Local swipe analysis with Kafka, HDFS and Spark

This school prototype implements a small data pipeline. Its main question is: **How does the like rate vary by job family and offer position in the feed?** It also identifies open offers with no recorded impressions and measures the time from a candidate like to a match.

PostgreSQL remains the application's source of truth. Analytics observes application activity; it does not change offers, decisions or ranking rules.

## Architecture and responsibilities

```text
Candidate uses the application
    |
    +-- Backend saves likes, passes and matches in PostgreSQL
    |       |
    |       +-- Publishes events after the transaction commits
    |
    +-- Browser reports visible cards through the authenticated API
            |
            v
    Kafka topic: rekr.swipe-events
            |
       events-sink (Node.js)
            |
       HDFS: raw JSON event files
            |
       Spark executes analyze.py on demand
            |
       Terminal tables + Parquet results in HDFS
```

| Component     | Purpose                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Kafka         | Stores and transports events independently of the application request. Consumers track their reading position with offsets.                     |
| `events-sink` | Consumes Kafka records and writes them to HDFS before confirming their offsets.                                                                 |
| Hadoop / HDFS | Hadoop provides the HDFS storage system. The NameNode manages file metadata; the DataNode stores file contents. This prototype has one of each. |
| Spark         | Executes data transformations, aggregations and the example machine-learning model.                                                             |
| Parquet       | A column-oriented file format for the calculated tables. It is not an application database or a dashboard.                                      |

### Why a separate `data/` directory?

This directory groups the independent analysis tools, HDFS configuration and Spark image definition. They have a different lifecycle from the web application: the API runs continuously, while the analysis runs when requested. Keeping these files together makes the school demonstration easier to inspect and keeps Python and Hadoop dependencies out of the backend image.

Code that must observe application actions stays with the application: the controller and publisher are in `backend/src/data/`, and the impression hook is in the frontend. The root `data/` directory contains the tools that consume or analyse those observations.

### Why extend the existing Kafka service?

Before this work, `docker/docker-compose.yml` defined Kafka for a sample logging flow:

```text
Sample log API endpoints -> logs.raw -> logs-sink -> PostgreSQL logs_raw
```

It did not collect candidate swipes, and the root development Compose did not start that Kafka service.

The existing admin-only endpoints, `POST /api/logs/sample` and `POST /api/logs/error`, remain useful for manually testing log publication to Kafka. When the legacy `logs-sink` is running, they can also test persistence in PostgreSQL's `logs_raw` table. Keeping this example provides a reference for a future pipeline that processes real application logs. However, these endpoints currently generate synthetic messages; they do not automatically collect real errors, and calling the error endpoint does not prove that a service failed. A future real-log integration would need to connect actual application logging to a producer, define and sanitize the event fields, and configure a suitable consumer and analysis. The current real-log observability flow uses Alloy, Loki and Grafana independently of this example. The data overlay does not start the legacy `logs-sink`.

`compose.data.yml` uses Compose `extends` to reuse the existing Kafka service definition, then adjusts ports, persistence, health checks and resource limits for this prototype. This avoids maintaining two independent copies of the broker configuration.

**`extends` reuses configuration; it does not connect to an already running container.** The merged root Compose project starts its own Kafka service. Do not also launch the full legacy `docker/docker-compose.yml` stack: it contains other application services and can conflict on ports. The old `logs-sink` is not imported. A second explicit `extends` entry reuses the existing `kafka-ui` service and connects it to this project's broker.

### Why add `compose.data.yml`?

It is an optional overlay for `compose.yml`. Together they enable backend event publication and frontend impression collection, and add Kafka, topic initialization, HDFS, the sink and Spark.

The normal development stack can run without these extra services. Production Compose is unchanged. The `data` profile contains the long-running data services. Spark uses the separate `data-jobs` profile and is started explicitly with `run spark`, so startup does not launch an analysis before data is available.

### Why Spark, and why Python?

Spark demonstrates batch processing, joins, aggregation, Parquet output and MLlib for the school's big-data objective. The same programming model supports larger distributed deployments, but **this prototype runs Spark locally inside one container with two worker threads** (`local[2]`). It is not a multi-machine Spark cluster.

At the current application volume, PostgreSQL could calculate the simple statistics. Spark and HDFS are an educational architecture, not a performance requirement for this small application.

Python is used through **PySpark**, Spark's Python API. It provides readable code for data preparation, DataFrames and machine-learning pipelines. It lets the analysis stay separate from the TypeScript request-handling code. Spark executes the query operations through its engine; Python describes the work to perform. Scala and Java are also possible choices, but are not necessary for this prototype.

`Dockerfile.spark` supplies Spark, Java, Python and NumPy in one image. Contributors do not need to install Python, Java or Spark on their host to run the Docker workflow.

## How the code knows what happened

There is no sentiment analysis. The application explicitly assigns the event type when an action occurs. A like is not inferred from text, and a pass does not explain why a candidate rejected an offer.

| Event              | Meaning                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `feed_delivered`   | The backend returned an offer in a feed batch.                                                  |
| `impression`       | At least 50% of the active offer card was visible in a visible browser tab.                     |
| `like`             | A new candidate like was saved.                                                                 |
| `pass`             | A new candidate pass was saved.                                                                 |
| `match`            | A new reciprocal match was created. A recruiter like is not counted as a second candidate like. |
| `catalog`          | One open offer in an explicitly requested catalog snapshot.                                     |
| `catalog_snapshot` | Marks the timestamp of that snapshot, including an empty catalog.                               |

An event carries a schema version, unique event ID, source (`real` or `synthetic`), type, server timestamp, and applicable candidate, offer, job-family and position fields. No names, emails, CVs or free text are sent. IDs are **pseudonymous, not anonymous**.

Delivered does not mean shown, and shown does not mean read. The browser sends an impression once per offer per page mount. Its signal can be lost or falsified. Position is the one-based index in the returned feed batch, not a global ranking position. An impression received after a decision is not retroactively assigned to that decision.

Repeated requests do not publish another like, pass or match while the corresponding record already exists. Changing a decision and making it again can produce another event. Rolled-back transactions do not publish decision events.

### File guide

| File                                                          | Main responsibility                                                                                                                                                           |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/data/impression.controller.ts`                   | Receives `POST /api/data/offers/:id/impression`. Requires authentication and the candidate role; validates position from 1 to 100. Candidate identity comes from the token.   |
| `backend/src/data/swipe-events.service.ts`                    | Enriches and publishes events asynchronously when `SWIPE_EVENTS_ENABLED=true`.                                                                                                |
| `backend/src/offer/offer.service.ts`                          | Calls the publisher after new decisions and matches commit, and when a feed is returned.                                                                                      |
| `clientApp/src/features/candidate-feed/useOfferImpression.ts` | Detects visible cards and sends impressions when `VITE_DATA_ANALYTICS_ENABLED=true`.                                                                                          |
| `data/sink.cjs`                                               | Reads the Kafka topic using consumer group `rekr-hdfs-v1`; commits offsets only after storage succeeds.                                                                       |
| `data/storage.cjs`                                            | Validates and whitelists event fields; writes a temporary HDFS file and renames it to its final name. Uses Node's HTTP client to handle the DataNode's interim HTTP response. |
| `data/catalog.cjs`                                            | Reads open offer IDs and job families from PostgreSQL and publishes a snapshot. Does not modify offers.                                                                       |
| `data/generate.cjs`                                           | Publishes repeatable synthetic examples without creating application records.                                                                                                 |
| `data/status.cjs`                                             | Compares Kafka topic offsets with the sink's committed offsets. Exits with code 1 while events remain pending.                                                                |
| `data/analyze.py`                                             | Defines the batch analysis and optional model.                                                                                                                                |
| `data/hadoop/`                                                | Configures HDFS storage paths and communication.                                                                                                                              |
| `data/Dockerfile.spark`                                       | Defines the isolated analysis runtime.                                                                                                                                        |

## What the Python script tells Spark to analyse

All current swipe-analysis logic is in `analyze.py`. Spark does not choose the questions itself. The script:

1. Reads JSON files from `hdfs://namenode:9000/lake/raw/events/*/*.json` with an explicit schema.
2. Filters schema version 1 and the requested source, then removes duplicate event IDs.
3. Selects likes and passes as completed decisions: like = 1, pass = 0.
4. Joins each decision to the most recent preceding impression for the same candidate and offer.
5. Calculates the tables below, and trains the example model when enough data exists.
6. Prints up to 30 rows per output table and writes the full tables as Parquet.

Each execution analyses the available stored history for that source. It is a **batch**, not a live dashboard: run it again after collecting more events.

| Output                                  | Interpretation                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `like_rate_by_family`                   | Likes / (likes + passes), grouped by job family. Eight likes and two passes give 0.8, or 80%. The denominator is not impressions or unique users.           |
| `like_rate_by_position`                 | The same rate by the last observed position before each decision. Missing impressions produce an unknown (`NULL`) position.                                 |
| `catalog_offers_without_impression`     | Offers in the latest catalog snapshot with no impression in the collected history. This does not prove they were never seen before collection started.      |
| `match_delays` / `match_delay_summary`  | Seconds between a match and the last preceding candidate like. Missing likes produce unknown delays; the summary distinguishes matches with observed likes. |
| `like_model`                            | A logistic-regression model using position and job family to estimate the probability of a like.                                                            |
| `model_coefficients`                    | Model associations in log-odds. Positive coefficients increase estimated like probability with other inputs held fixed. They do not prove causation.        |
| `like_predictions` / `model_evaluation` | Predictions and AUC on held-out candidates, when the test set contains both likes and passes. AUC measures discrimination, not percentage accuracy.         |
| `run_summary`                           | Source, run ID and input counts, written at the end of a successful batch.                                                                                  |

Results are stored under `/lake/curated/source=<real-or-synthetic>/run=<timestamp-and-id>/`. A failed run can leave intermediate outputs; check for `run_summary` and successful process completion.

### What the model can and cannot tell us

The model needs at least 20 training decisions with known positions and both outcome classes. Candidates are assigned deterministically to approximately 80% training and 20% test sets, so one candidate does not appear in both. Job families are encoded as categories, not ordered numbers. Unknown-position decisions remain in descriptive statistics but are excluded from training.

With few real swipes, skipping the model is expected. Predictions and AUC are only saved when the test set contains both classes. Coefficients for position and job-family categories use different units; their absolute values are not a universal feature-importance ranking.

The analysis measures behaviour, not feelings or motives. Position effects can reflect exposure bias. It does not evaluate all salary, skills, location, contract or remote-work criteria in `ranking-rules.ts`, and **it never changes application ranking**. Analysing those weights would require recording the ranking inputs and version at exposure time.

## Delivery, storage and deployment limits

The backend publishes after the database transaction, with bounded asynchronous work and short retries. If Kafka fails, the swipe can still succeed in PostgreSQL while its event is lost. The backend logs `swipe_events_dropped`. A production improvement would be a transactional outbox: save the business change and a pending event in one database transaction, then retry publication from a worker. Consumers must still handle duplicates.

Once an event reaches Kafka, the sink writes it to HDFS before committing its offset. Its partition/offset/event-ID filename makes retries idempotent. A temporary file is renamed only after a successful write. Failed writes and invalid events are not acknowledged. There is no dead-letter queue. Spark also deduplicates event IDs.

Kafka has three topic partitions and replication factor 1. Candidate/offer keys keep events for a pair in the same partition; there is no global order across partitions. Retention is configured to 24 hours and 256 MiB per partition, subject to segment cleanup. These are not strict disk quotas, and a prolonged consumer outage can outlast retention. HDFS has no automatic retention policy here.

One file per event makes a small demonstration easy to inspect, but would create too many small files at scale. A larger implementation should write compacted batches. One broker and one DataNode provide no high availability.

### Why this stays off the 2 GB deployment server

Our school deployment server has 2 GB of RAM and is used to demonstrate application deployment. Kafka, HDFS and Spark need additional memory alongside PostgreSQL, the application and monitoring. Spark alone has a 2 GB container limit; this is a ceiling, not reserved or guaranteed memory.

Run the data demonstration on a development computer with several additional GB of available memory and disk space. Keep `compose.data.yml` out of the server deployment. This separates the deployment demonstration from the local big-data demonstration without claiming production readiness.

Before real production use, the system would need authenticated and encrypted service connections, access controls, durable delivery, appropriate replication, monitoring, retention and deletion procedures. Docker volumes survive container recreation but are not backups: recovery requires separate backup copies and tested restores of application data and analytics storage. The current prototype does not implement these procedures.

Prometheus, Grafana and Loki serve the separate observability use case. Kafka UI displays raw events and consumer lag. It does not calculate Spark statistics. No swipe-analysis dashboard or Streamlit service is added by this overlay.

## Step-by-step guide for contributors

### 1. Prepare the environment

Pull the branch containing these changes and open a Bash/WSL terminal at the repository root. Use the repository's normal development configuration. Real-event testing requires development accounts and open offers; the synthetic route below does not require creating business records.

Make sure Docker Desktop is running, WSL integration is enabled if applicable, and the required local ports are free. Compose 2.24.4 or later is required for `!override`.

```bash
docker info
docker compose version

# This shortcut exists only in the current shell.
dc() { docker compose -f compose.yml -f compose.data.yml --profile data "$@"; }
dc config --quiet
```

Always combine the two files. Do not start `compose.data.yml` alone or start the legacy stack alongside it.

### 2. Start the application and data services

```bash
dc up -d --build backend frontend kafka kafka-ui namenode datanode events-sink
dc ps -a
```

Compose also starts the application's dependencies and topic initialization. Wait for Kafka, NameNode and DataNode to be healthy. `kafka-init` should exit successfully with code 0; `events-sink` should stay running. Wait before using the feed, because early events can be lost while Kafka is unavailable.

### 3. Build the analysis image

```bash
dc build spark
```

This downloads the Spark runtime and installs NumPy. After it succeeds, later commands use `--no-build`.

### 4. Generate real events through the UI

Open [the application](http://localhost:8080). Sign in as a candidate, open the feed, keep a card visible briefly, like one new offer and pass another. To produce a match, use a recruiter account to reciprocate a candidate like.

To watch new Kafka events, run this before interacting with the UI:

```bash
dc exec kafka /opt/kafka/bin/kafka-console-consumer.sh   --bootstrap-server kafka:9092   --topic rekr.swipe-events
```

Press Ctrl+C to stop this viewer; it does not stop Kafka or the sink. The default viewer starts with new events. Add `--from-beginning --max-messages 10` to inspect up to ten retained events instead; it waits if fewer are available.

Export the open-offer catalog, and repeat this export after changing offers:

```bash
dc exec backend node data/catalog.cjs
```

For 39 open offers, this publishes 39 catalog records plus one snapshot marker. It does not create likes or impressions.

### 5. Wait for storage to catch up

```bash
dc exec backend node data/status.cjs
dc exec namenode hdfs dfs -ls -R /lake/raw/events
```

Repeat the status command until **every partition shows `0 pending event(s)`**. A nonzero count immediately after publication is normal. The files should have final `.json` names. Zero lag means the sink has caught up with Kafka; it cannot detect events that the backend failed to publish.

### 6. Analyse real events

```bash
dc run --rm --no-build spark   --master 'local[2]'   --driver-memory 1g   /opt/rekr/analyze.py   --source real
```

Read the tables printed in the terminal and the final `Outputs:` path. Empty tables and a skipped model can be normal with a small sample. The process should finish successfully and write `run_summary`.

```bash
dc exec namenode hdfs dfs -ls -R /lake/curated/source=real
```

Parquet files are binary analysis files; `hdfs dfs -cat` does not render them as readable tables. Use the printed tables for the demonstration. A rerun creates a new output directory and includes the available history.

### 7. Optionally run a repeatable synthetic demonstration

```bash
dc exec backend node data/generate.cjs 500
dc exec backend node data/status.cjs
# Repeat status until every partition has zero pending events.
dc run --rm --no-build spark   --master 'local[2]'   --driver-memory 1g   /opt/rekr/analyze.py   --source synthetic
```

The current default seed generates 500 decisions: 277 likes and 223 passes, plus 87 matches, impressions and catalog events. Five synthetic offers have no impressions. The generated like-to-match interval is 299.8 seconds. These results describe artificial examples, not user behaviour.

The generator never writes business records to PostgreSQL. Real and synthetic events share the topic but are filtered into separate analysis outputs. Each generator execution adds another dataset; repeating it increases accumulated counts.

### 8. Know which interfaces are available

| Address / location          | What it provides                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http://localhost:8080`     | Application UI for generating real activity.                                                                                                            |
| `http://localhost:3001/api` | Backend API with default development ports.                                                                                                             |
| `http://localhost:8085`     | Kafka UI: select cluster `rekr`, open Topics, then `rekr.swipe-events` and Messages to browse events. Consumer Groups shows `rekr-hdfs-v1` and its lag. |
| `http://localhost:9870`     | HDFS NameNode status. File-browser links to `datanode` can be internal to Docker; use the HDFS CLI above for file inspection.                           |
| `localhost:29092`           | Kafka protocol endpoint from the host, not a website. Containers use `kafka:9092`.                                                                      |
| Spark command output        | Analysis tables. No persistent Spark web UI is exposed.                                                                                                 |
| Existing Grafana            | Application monitoring, if started separately; no new swipe-analysis panels.                                                                            |

Kafka UI is bound to localhost for this development demonstration. To start it on an already running data stack, use `dc up -d kafka-ui`. Refresh the Messages view after making a swipe; selecting earlier offsets lets you inspect retained events. Kafka UI reads Kafka, not HDFS or Spark results.

### 9. Troubleshoot common problems

**Pending counts do not decrease:**

```bash
dc logs --tail 50 events-sink kafka namenode datanode
```

A persistent `._...tmp` file means storage did not complete. The current HTTP client handles the DataNode interim response that caused `fetch failed` in an earlier version. After pulling a storage-code fix, restart only the sink so it retries uncommitted events:

```bash
dc restart events-sink
```

Do not reset offsets or delete data to hide a failed write.

**KafkaJS warnings:** the default-partitioner warning explains a library default. `TimeoutNegativeWarning` has also been observed in KafkaJS's request timer. These warnings alone do not prove delivery failed; check lag, final files and sink errors. They are not suppressed by this prototype.

**WSL reports `error getting credentials` / `UtilAcceptVsock` while building:** this happens before Spark runs. Check Docker Desktop and its WSL integration. In our local test, building from Windows PowerShell at the same repository root succeeded with the same Docker Desktop engine:

```powershell
docker pull spark:3.5.6-scala2.12-java17-python3-ubuntu
docker compose -f compose.yml -f compose.data.yml --profile data build spark
```

Then return to WSL and run the analysis with `--no-build`. This assumes both shells use the same Docker engine. Do not remove credentials or change Spark versions to work around this error.

**No events / model skipped:** collect events for the selected source, wait for the sink, and check the model requirements above. A missing raw-data path means there is no stored input yet. Use the synthetic demonstration for a larger sample.

### 10. Run the focused checks

With the backend running, the storage tests need no host Node installation:

```bash
dc exec backend node --test data/storage.test.cjs
```

For the application checks, use the repository's supported Node version and installed dependencies:

```bash
(cd backend && npx jest --runInBand --runTestsByPath   src/data/swipe-events.service.spec.ts   src/data/swipe-hooks.spec.ts   src/data/impression.controller.spec.ts   src/offer/offer.service.spec.ts)
(cd backend && npx tsc -p tsconfig.build.json --noEmit --incremental false)
(cd backend && npx eslint src/data src/offer/offer.service.ts src/offer/offer.module.ts)
(cd clientApp && npx vitest run src/features/candidate-feed)
(cd clientApp && npx tsc -b --noEmit)
```

These focused checks complement, but do not replace, the repository's complete CI suite.

### 11. Stop collection without deleting stored data

```bash
dc stop kafka-ui events-sink datanode namenode kafka
docker compose -f compose.yml up -d backend frontend
```

The application returns to its normal configuration without the overlay's collection flags. Kafka and HDFS volumes remain. Do not use `down -v` on the whole stack: it can also delete application, upload and monitoring data.
