# Experiment 5 — Continuous Deployment (CD)

**Project:** Event Volunteer & Crowd Coordination Platform (EVCP)  
**Curriculum Track:** Experiment 5 (Automated Deployment / Continuous Deployment)

---

## 1. Objective

Implement and locally verify an end-to-end **Continuous Deployment (CD)** pipeline where every verified commit to `main` that passes the complete Continuous Integration (CI) test and build gates automatically deploys, updates, and health-checks the running application containers using Docker Compose.

---

## 2. CI/CD Architecture Flow

```text
Developer Push to 'main'
         │
         ▼
 ┌────────────────────────────────────────┐
 │       GitHub Actions CI Stage          │
 ├────────────────────────────────────────┤
 │ 1. Backend Tests (Python 3.13, pytest) │
 │ 2. Frontend Checks (oxlint, vite)      │
 │ 3. Standalone Docker Image Build       │
 └───────────────────┬────────────────────┘
                     │ All checks PASS (Green)
                     ▼
 ┌────────────────────────────────────────┐
 │       GitHub Actions CD Stage          │
 ├────────────────────────────────────────┤
 │ 1. docker compose config (Validation)  │
 │ 2. docker compose build                │
 │ 3. docker compose up -d (Deploy)       │
 │ 4. Probe /health & /nginx-health       │
 └───────────────────┬────────────────────┘
                     │ Health checks HTTP 200
                     ▼
           Deployment SUCCESS ✅
 (Frontend :3000, Backend :8000, Prometheus :9090, Grafana :3001)
```

---

## 3. Tools & Infrastructure

- **Version Control & CI/CD Orchestrator:** GitHub Actions (`.github/workflows/ci.yml`)
- **Container Engine:** Docker Engine 28.0+
- **Multi-Service Orchestration:** Docker Compose v2.33+
- **Application Services:**
  - `evcp-backend` (FastAPI / Python 3.13 / Uvicorn / SQLite 3)
  - `evcp-frontend` (React 19 / Vite 8.3 / Nginx 1.27)
  - `evcp-prometheus` (Prometheus TSDB v2.54.1)
  - `evcp-grafana` (Grafana Analytics 11.2.0)
- **Networking:** Private Bridge Network (`evcp-network`)
- **Storage:** Named Docker Volumes (`evcp_db_data`, `evcp_uploads_data`, `prometheus_data`, `grafana_data`)

---

## 4. Deployment Pipeline Execution Steps

1. **Gatekeeper Dependency (`needs: [docker-build]`):**  
   The `deploy` job triggers only when all upstream CI jobs (`backend-tests`, `frontend-checks`, and `docker-build`) terminate with status code 0. Pull requests only execute CI; direct pushes and merges into `main` trigger both CI and CD.

2. **Compose Configuration Validation:**
   ```bash
   docker compose config
   ```
   Validates service declarations, network aliases, volume mounts, and environment substitutions.

3. **Multi-Service Build:**
   ```bash
   docker compose build
   ```
   Compiles and layers updated production images without cache corruption.

4. **In-Place Rolling Deployment:**
   ```bash
   docker compose up -d
   ```
   Recreates updated containers with zero volume data destruction.

5. **Readiness Probe & Health Verification:**
   Polls container health inspect status until reaching `healthy` (up to 60s timeout), followed by HTTP endpoint probes:
   - Backend API: `curl -f http://localhost:8000/health` (HTTP 200)
   - Frontend SPA: `curl -f http://localhost:3000/nginx-health` (HTTP 200)
   - Prometheus: `curl -f http://localhost:9090/-/healthy` (HTTP 200)
   - Grafana: `curl -f http://localhost:3001/api/health` (HTTP 200)

---

## 5. Local Verification & Evidence Log

### A. CI Validation
- **Backend Test Suite:** 14 test modules passing under `pytest -v` in 18.18s.
- **Frontend Code Quality:** `oxlint` executed with 0 errors.
- **Frontend Bundle:** `vite build` generated production bundle in 1.07s.
- **Docker Build Isolation:** Built `evcp-backend:ci` and `evcp-frontend:ci` cleanly.

### B. CD Deployment Execution
Executed locally using Docker Compose:
```bash
docker compose build
docker compose up -d
```
Observed container state:
```text
NAME              IMAGE                               COMMAND                  STATUS                    PORTS
evcp-backend      event-volunteer-platform-backend    "/app/entrypoint.sh …"   Up (healthy)              0.0.0.0:8000->8000/tcp
evcp-frontend     event-volunteer-platform-frontend   "/docker-entrypoint.…"   Up (healthy)              0.0.0.0:3000->80/tcp
evcp-prometheus   prom/prometheus:v2.54.1             "/bin/prometheus …"      Up (healthy)              0.0.0.0:9090->9090/tcp
evcp-grafana      grafana/grafana:11.2.0              "/run.sh"                Up (healthy)              0.0.0.0:3001->3000/tcp
```

### C. Post-Deployment Health Check Responses
```json
// GET http://localhost:8000/health
HTTP 200 OK
{
  "status": "healthy",
  "service": "Event Volunteer & Crowd Coordination API",
  "timestamp": "2026-10-07T19:13:07.556829"
}

// GET http://localhost:3000/nginx-health
HTTP 200 OK
healthy
```

---

## 6. Failure Handling Policy

1. **Broken CI Blocks Deployment:**  
   If any backend test, lint rule, or frontend build fails in the CI matrix, GitHub Actions terminates immediately with failure. The `deploy` job never triggers (`needs: [docker-build]` condition is unmet).
2. **Health Check Failure Blocks Rollout:**  
   If a container starts but fails the `/health` endpoint probe within 60 seconds, the workflow executes `docker compose logs backend` and exits with code 1, marking the CD pipeline run as failed.
3. **Data Integrity Guarantee:**  
   Deployment utilizes persistent named volumes (`evcp_db_data`, `evcp_uploads_data`), ensuring that container updates never destroy persistent database state or user records.

---

## 7. Status

- **CI Pipeline:** `VERIFIED`
- **CD Pipeline Definition:** `VERIFIED`
- **Docker Compose Deployment Flow:** `VERIFIED`
- **Multi-Service Health Checks:** `VERIFIED`
- **Volume Persistence across Deployments:** `VERIFIED`
