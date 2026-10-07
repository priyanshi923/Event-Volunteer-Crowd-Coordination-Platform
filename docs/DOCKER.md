# Docker Containerization Guide

**Project:** Event Volunteer & Crowd Coordination Platform  
**Target:** Experiment 2 (To containerize application using Docker)

---

## 1. Overview & Architecture

The application is containerized into two dedicated, production-optimized container images:
1. **`evcp-backend`**: Python 3.13-slim image running FastAPI via Uvicorn under an unprivileged user (`appuser`).
2. **`evcp-frontend`**: Multi-stage production build using Node 20-alpine to build the Vite/React static bundle and Nginx 1.27-alpine to serve it with SPA routing and API reverse proxying.

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│        Frontend Container       │       │        Backend Container        │
│       Image: evcp-frontend      │       │       Image: evcp-backend       │
│  (Nginx 1.27-alpine, Port 80)   │       │   (Python 3.13-slim, Port 8000) │
│                                 │       │                                 │
│  • React 19 / Vite SPA Build    │       │  • FastAPI REST APIs            │
│  • SPA Routing (/index.html)    │──────▶│  • /health & /metrics (Prom)    │
│  • Reverse Proxy (/api, /upload)│       │  • SQLite Storage (/app/*.db)   │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

---

## 2. Dockerfile Specifications

### A. Backend Dockerfile (`backend/Dockerfile`)
- **Base Image:** `python:3.13-slim`
- **Security:** Executes under an unprivileged system user (`appuser`, UID/GID non-root) with assigned permissions for SQLite storage and static upload directories.
- **Port:** Exposes `8000` (configurable dynamically via `PORT`).
- **Healthcheck:** Evaluates container health using `curl -f http://localhost:${PORT}/health`.
- **Command:** `uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`

### B. Frontend Dockerfile (`frontend/Dockerfile`)
- **Multi-Stage Build:**
  - **Stage 1 (`builder`):** `node:20-alpine` runs `npm ci` and `npm run build`, generating the minified production bundle in `/app/dist`. Accepts optional build argument `VITE_API_BASE_URL`.
  - **Stage 2 (`runner`):** `nginx:1.27-alpine` copies solely the static `/app/dist` assets into `/usr/share/nginx/html` and mounts `nginx.conf`.
- **Port:** Exposes `80`.
- **Healthcheck:** Evaluates readiness via `wget --quiet --spider http://127.0.0.1/nginx-health`.

---

## 3. Docker Ignore Strategy

Both directories utilize strict `.dockerignore` files to prevent image bloat and leakage of secrets:

- **`backend/.dockerignore`:** Excludes `venv/`, `__pycache__/`, `.pytest_cache/`, `*.db`, `.env`, and IDE artifacts.
- **`frontend/.dockerignore`:** Excludes `node_modules/`, `dist/`, `.vite/`, `.env`, and build logs.

---

## 4. Build Instructions

Run the following commands from the project root (`event-volunteer-platform`):

### Build Backend Image
```bash
docker build -t evcp-backend:latest ./backend
```

### Build Frontend Image
```bash
docker build -t evcp-frontend:latest ./frontend
```

*Optionally provide a custom API endpoint at frontend build time:*
```bash
docker build --build-arg VITE_API_BASE_URL="http://localhost:8000/api" -t evcp-frontend:latest ./frontend
```

---

## 5. Running Containers Individually

### 1. Run Backend Container
```bash
# Run backend on host port 8000 with volume for persistent SQLite database
docker run -d \
  --name evcp-backend \
  -p 8000:8000 \
  -e PORT=8000 \
  -e HOST=0.0.0.0 \
  -e CORS_ORIGINS="*" \
  -v evcp_data:/app \
  evcp-backend:latest
```

### 2. Run Frontend Container
```bash
# Run frontend on host port 3000 (or 80)
docker run -d \
  --name evcp-frontend \
  -p 3000:80 \
  evcp-frontend:latest
```

---

## 6. Container Verification & Health Checks

Once containers are started, verify status and metrics:

### Backend Health Check
```bash
curl http://localhost:8000/health
# Expected Output: {"status":"healthy","service":"Event Volunteer & Crowd Coordination API",...}
```

### Backend Prometheus Metrics
```bash
curl http://localhost:8000/metrics
# Expected: Prometheus exposition containing evcp_volunteers_total, http_requests_total, etc.
```

### Frontend Web UI Verification
```bash
curl -I http://localhost:3000/
# Expected: HTTP/1.1 200 OK
```

### Inspect Container Health Probes
```bash
docker inspect --format='{{json .State.Health.Status}}' evcp-backend
docker inspect --format='{{json .State.Health.Status}}' evcp-frontend
```

---

## 7. Environment Variables Reference

| Variable | Target | Default | Description |
|---|---|---|---|
| `PORT` | Backend | `8000` | HTTP port Uvicorn listens on |
| `HOST` | Backend | `0.0.0.0` | IP binding interface |
| `DATABASE_URL` | Backend | `sqlite:///./event_platform.db` | SQLAlchemy connection string |
| `CORS_ORIGINS` | Backend | `*` | Allowed CORS origins (comma-separated) |
| `VITE_API_BASE_URL` | Frontend | `http://127.0.0.1:8000/api` | Base URL used by Axios for REST calls |
