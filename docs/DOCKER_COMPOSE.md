# Docker Compose Multi-Service Deployment Guide

**Project:** Event Volunteer & Crowd Coordination Platform  
**Target:** Experiment 3 (Deploy multi-service applications using Docker Compose)

---

## 1. Multi-Service Architecture Overview

Docker Compose orchestrates the platform into a cohesive, isolated 4-service ecosystem communicating across a private bridge network (`evcp-network`).

```text
Host: :3000                        Host: :8000
    │                                  │
    ▼                                  ▼
┌─────────────────────────┐        ┌─────────────────────────┐
│     evcp-frontend       │        │      evcp-backend       │
│   (Nginx 1.27-alpine)   │        │    (Python 3.13-slim)   │
│   React 19 SPA Build    │───────▶│    FastAPI REST APIs    │
│   /nginx-health         │ /api/  │    /health & /metrics   │
└─────────────────────────┘        └─────────────────────────┘
                                                ▲
                                                │ Scrape /metrics (10s)
Host: :3001                        Host: :9090  │
    │                                  │        │
    ▼                                  ▼        │
┌─────────────────────────┐        ┌─────────────────────────┐
│      evcp-grafana       │        │     evcp-prometheus     │
│    (Grafana 11.2.0)     │───────▶│  (Prometheus v2.54.1)   │
│   Pre-wired Datasource  │ PromQL │   TSDB Time-Series      │
│   /api/health           │        │   /-/healthy            │
└─────────────────────────┘        └─────────────────────────┘
```

---

## 2. Services Breakdown

| Service | Container Name | Image / Build Context | Internal Port | Host Port | Role |
|---|---|---|---|---|---|
| **`frontend`** | `evcp-frontend` | `./frontend/Dockerfile` | `80` | `3000` | Serves compiled React assets, handles SPA routing, and reverse proxies `/api/` calls to `http://backend:8000`. |
| **`backend`** | `evcp-backend` | `./backend/Dockerfile` | `8000` | `8000` | Runs FastAPI with Uvicorn, executes the 2-stage assignment engine, and exposes `/health` and `/metrics`. |
| **`prometheus`**| `evcp-prometheus`| `prom/prometheus:v2.54.1` | `9090` | `9090` | Time-series database scraping backend metrics at 10-second intervals. |
| **`grafana`** | `evcp-grafana` | `grafana/grafana:11.2.0` | `3000` | `3001` | Visualization dashboard pre-configured with Prometheus as its default datasource. |

---

## 3. Inter-Service Communication & Networking

- **Network Name:** `evcp-network` (driver: `bridge`)
- **DNS Resolution:** Services communicate using Docker container names rather than `localhost`:
  - Frontend Nginx proxies to `http://backend:8000`
  - Prometheus scrapes `backend:8000/metrics`
  - Grafana queries Prometheus via `http://prometheus:9090`

---

## 4. Persistent Storage (Named Volumes)

Four isolated named volumes ensure that container restarts and rebuilds preserve all platform data:

1. **`evcp_db_data`**: Mounted to `/app/data` to persist the SQLite database (`event_platform.db`).
2. **`evcp_uploads_data`**: Mounted to `/app/uploads` to preserve uploaded event images.
3. **`prometheus_data`**: Mounted to `/prometheus` for time-series historical metrics retention.
4. **`grafana_data`**: Mounted to `/var/lib/grafana` for dashboards and user preferences.

---

## 5. Health Checks & Startup Dependency Ordering

Services implement health-conditioned startup dependencies:

- **Backend:** Probed via `curl -f http://localhost:8000/health || exit 1`
- **Frontend:** Probed via `wget --quiet --spider http://127.0.0.1/nginx-health || exit 1` (waits for `backend` to be healthy)
- **Prometheus:** Probed via `wget --quiet --spider http://localhost:9090/-/healthy || exit 1` (waits for `backend` to be healthy)
- **Grafana:** Probed via `wget --quiet --spider http://localhost:3000/api/health || exit 1` (waits for `prometheus` to be healthy)

---

## 6. CLI Management Commands

> **Note:** These commands require Docker Desktop / Docker Engine installed and running on the host system.

### Build and Launch the Entire Stack
```bash
docker compose up --build -d
```

### Check Running Services and Health Status
```bash
docker compose ps
```

### Inspect Aggregated or Service-Specific Logs
```bash
# View logs from all services in real time
docker compose logs -f

# View only backend or prometheus logs
docker compose logs -f backend
docker compose logs -f prometheus
```

### Stop the Stack (Preserving Volumes)
```bash
docker compose down
```

### Stop and Wipe Volumes (Fresh State Reset)
```bash
docker compose down -v
```

---

## 7. Verification Endpoints (Once Running)

| Target | URL | Expected Response |
|---|---|---|
| **Volunteer & Coordinator UI** | `http://localhost:3000` | React web application |
| **Backend Health Probe** | `http://localhost:8000/health` | `{"status":"healthy",...}` |
| **Backend Prometheus Metrics**| `http://localhost:8000/metrics` | Prometheus text exposition |
| **Prometheus Web Console** | `http://localhost:9090` | Prometheus UI (Targets → UP) |
| **Grafana Dashboard Portal** | `http://localhost:3001` | Grafana Login (`admin` / `admin`) |
