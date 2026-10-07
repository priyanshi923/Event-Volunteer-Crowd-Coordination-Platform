Now implement **Phase 2, Step 4: Docker Compose Multi-Service Deployment** for the existing Event Volunteer & Crowd Coordination Platform.

This implements:

**Experiment 3 — To deploy multi-service applications using Docker Compose.**

IMPORTANT:

* Do NOT rebuild the application.
* Do NOT modify existing business logic.
* Do NOT redesign the frontend.
* Do NOT migrate SQLite to PostgreSQL.
* Preserve all existing APIs and functionality.
* Reuse the Dockerfiles already created in Step 3.
* Docker Compose should orchestrate the complete development/demo environment.
* Do NOT create CI/CD pipelines yet.

## 1. Create Docker Compose configuration

Create at the project root:

`docker-compose.yml`

The Compose stack must contain these services:

### Service 1 — frontend

Use:

`./frontend/Dockerfile`

Requirements:

* React production build served through Nginx.
* Expose the frontend on a convenient host port such as `3000`.
* Depend on the backend being available.
* Use the existing Nginx configuration.
* `/api` requests must reach the backend service through the Docker network.

### Service 2 — backend

Use:

`./backend/Dockerfile`

Requirements:

* Expose FastAPI internally on port `8000`.
* Make `/health` available.
* Make `/metrics` available.
* Use the existing SQLite database.
* Persist the SQLite database using a Docker volume so restarting the container does not erase application data.
* Persist the existing uploads directory using a Docker volume.
* Use environment variables for configuration.
* Do NOT put secrets directly in docker-compose.yml.

### Service 3 — prometheus

Use an official Prometheus image.

Requirements:

* Add a Prometheus service.
* Mount a project configuration file:

`monitoring/prometheus/prometheus.yml`

* Prometheus must scrape the backend `/metrics` endpoint.
* Scrape interval should be appropriate for a demo, e.g. 5–15 seconds.
* Persist Prometheus data using a named volume.
* Expose Prometheus on a convenient host port such as `9090`.

The Prometheus target should use the Docker service name, NOT localhost.

For example:

`backend:8000`

not:

`localhost:8000`

### Service 4 — grafana

Use an official Grafana image.

Requirements:

* Add Grafana as a Compose service.
* Grafana must be able to communicate with Prometheus through the Docker network.
* Persist Grafana data using a named volume.
* Expose Grafana on a convenient host port such as `3001`.
* Configure Prometheus as the Grafana data source automatically if practical.

Do NOT create the final interactive dashboard yet. That will be a later step.

## 2. Create Prometheus configuration

Create:

`monitoring/prometheus/prometheus.yml`

Configure Prometheus to scrape:

`backend:8000/metrics`

The configuration should include a clear job name such as:

`event-volunteer-backend`

Do not use localhost for the backend target inside Compose.

## 3. Docker networking

Create/use a dedicated Compose network so that:

```text
frontend → backend
prometheus → backend
grafana → prometheus
```

Use Docker service names for internal communication.

The architecture should be:

```text
                    ┌──────────────┐
                    │   Frontend   │
                    │ React + Nginx│
                    │    :3000    │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Backend    │
                    │   FastAPI    │
                    │    :8000     │
                    └──────┬───────┘
                           │
                  /metrics │
                           ▼
                    ┌──────────────┐
                    │ Prometheus   │
                    │    :9090     │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Grafana    │
                    │    :3001     │
                    └──────────────┘
```

## 4. Health checks

Add Docker Compose health checks where appropriate.

Backend:

`GET /health`

Frontend:

`/nginx-health`

Prometheus/Grafana should use appropriate service health checks if practical.

Use health checks for service dependency ordering where appropriate.

Do NOT rely solely on `depends_on` without health conditions if the Compose version supports health-based dependencies.

## 5. Persistent volumes

Create named volumes for:

* Backend SQLite database
* Backend uploads
* Prometheus data
* Grafana data

The purpose is to demonstrate that service/container recreation does not automatically destroy persistent application/monitoring data.

Do not commit generated database files or monitoring data into Git.

## 6. Environment configuration

Create an example environment file if useful:

`.env.example`

It must contain only safe example/default values.

Do NOT create or commit a real `.env` containing secrets.

Support configuration for:

* backend port
* database URL
* CORS origins
* frontend API configuration
* Grafana admin credentials

Use safe demo defaults where appropriate, but clearly mark credentials as development/demo credentials.

## 7. Update Git ignore rules

Ensure `.gitignore` ignores:

* `.env`
* Docker-generated data
* local database files
* monitoring data
* other runtime artifacts

Do not accidentally ignore source configuration files such as:

`docker-compose.yml`

or:

`monitoring/prometheus/prometheus.yml`

## 8. Documentation

Create:

`docs/DOCKER_COMPOSE.md`

Document:

* Complete service architecture
* Each service's purpose
* Ports
* Docker network
* Volumes
* Prometheus scraping flow
* How frontend communicates with backend
* How Grafana communicates with Prometheus
* How to start everything
* How to stop everything
* How to rebuild everything
* How to inspect service logs

Include commands such as:

`docker compose up --build`

`docker compose down`

`docker compose ps`

`docker compose logs`

Do not claim commands were executed if Docker is unavailable on the machine.

## 9. Docker availability

First check whether Docker Desktop / Docker CLI is actually available.

If Docker is NOT installed:

* Still create and validate all Compose configuration files.
* Run static/configuration validation if possible.
* Do NOT pretend that containers were successfully started.
* Clearly report that runtime validation requires Docker Desktop.
* Do NOT install Docker automatically.

If Docker IS available:

Actually run:

`docker compose config`

Then:

`docker compose build`

Then start the stack and verify:

* Frontend
* Backend
* `/health`
* `/metrics`
* Prometheus
* Grafana
* Prometheus backend target is UP

Use appropriate logs if something fails and fix configuration issues without changing application functionality.

## 10. Existing tests

Run:

* `test_monitoring.py`
* `test_e2e_final.py`
* `test_enhancements.py`

Do not remove or weaken tests.

If Docker is available, additionally perform basic container-level smoke tests.

## 11. Final report

Report:

1. Files created/modified
2. Compose services
3. Ports
4. Volumes
5. Network configuration
6. Prometheus scrape configuration
7. Docker availability
8. `docker compose config` result
9. Container build/start results if Docker is available
10. Backend health result
11. Prometheus target result
12. Grafana accessibility result
13. Existing test results
14. Any unresolved issues

IMPORTANT:

* Do NOT create CI/CD yet.
* Do NOT create the final Grafana dashboard yet.
* Do NOT modify Jira yet.
* Do NOT commit or push automatically.

Stop after this step and wait for my next instruction.
