## Phase 2 — Step 4B: Docker Compose Runtime Verification

Docker Desktop is now installed and available on the host.

We previously created and statically validated the Docker Compose setup for the Event Volunteer & Crowd Coordination Platform. Now perform the ACTUAL runtime verification.

### 1. Verify Docker

Run:

```powershell
docker --version
docker compose version
docker info
```

If Docker Engine is not running, clearly report that and STOP. Do not pretend the containers started.

### 2. Validate Compose

From the project root run:

```powershell
docker compose config
```

Fix only genuine configuration errors if found.

### 3. Build the complete stack

Run:

```powershell
docker compose build
```

The expected services are:

* frontend
* backend
* prometheus
* grafana

Do not skip the actual build.

### 4. Start the stack

Run:

```powershell
docker compose up -d
```

Then:

```powershell
docker compose ps
```

All four services should be running/healthy.

### 5. Verify each service

Backend:

```powershell
curl http://localhost:8000/health
```

Expected HTTP 200.

Metrics:

```powershell
curl http://localhost:8000/metrics
```

Confirm Prometheus metrics are exposed.

Frontend:

```powershell
curl http://localhost:3000/nginx-health
```

Expected HTTP 200.

Prometheus:

Open/check:

```text
http://localhost:9090
```

Verify the target:

```text
Status → Targets
```

The `event-volunteer-backend` target must show **UP**.

Grafana:

Open/check:

```text
http://localhost:3001
```

Verify Grafana starts successfully and the Prometheus datasource is automatically configured.

### 6. Verify Docker networking

Confirm containers communicate using Docker service names:

* frontend → backend
* prometheus → backend
* grafana → prometheus

Do NOT change these to localhost.

### 7. Verify persistence

Confirm the named volumes exist:

```powershell
docker volume ls
```

Expected volumes include:

* evcp_db_data
* evcp_uploads_data
* prometheus_data
* grafana_data

Do not delete any existing project data.

### 8. Run project tests

Run:

```powershell
cd backend
python -m pytest test_monitoring.py -q
python -m pytest test_e2e_final.py -q
python -m pytest test_enhancements.py -q
```

All existing tests should continue passing.

### 9. Cleanup instructions

Do NOT run `docker compose down -v`.

Keep the named volumes because persistence is part of Experiment 3.

You may use:

```powershell
docker compose down
```

only if necessary after verification.

### 10. Report

Return a concise report containing:

* Docker version
* Compose version
* `docker compose config` result
* build result
* service status
* backend health result
* metrics result
* frontend result
* Prometheus target result
* Grafana result
* volume result
* test results
* any errors encountered

IMPORTANT:

* Do not create CI/CD yet.
* Do not create the final Grafana dashboard yet.
* Do not modify Jira yet.
* Do not create commits or push to GitHub.
* Do not add unrelated features.

Stop after runtime verification and wait for the next instruction.
