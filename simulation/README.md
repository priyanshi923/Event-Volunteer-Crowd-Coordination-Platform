# Local simulation stack (no Docker required)

Runs the whole EVCP DevOps stack natively on a dev machine: app, Jira, monitoring, and CI.

| Piece | How it runs locally | URL |
|---|---|---|
| Backend (FastAPI) | `uvicorn` from `backend/` | http://127.0.0.1:8000 (docs at `/docs`, metrics at `/metrics`) |
| Frontend (Vite) | `npm run dev` in `frontend/` | http://localhost:5173 |
| Jira Cloud | `jira_simulator.py` — implements the Jira REST v3 calls `backend/jira_service.py` makes, plus a board UI that fires webhooks back to EVCP | http://127.0.0.1:8090 |
| Prometheus | official Windows binary in `tools/` | http://127.0.0.1:9090 |
| Grafana | official Windows binary in `tools/`, provisioned with `monitoring/grafana` (login `admin` / `admin`) | http://127.0.0.1:3001 |
| Live traffic | `traffic_simulator.py` — gate check-ins/outs, incidents reported → acknowledged → resolved | — |
| GitHub Actions | `run_ci_local.py` — executes `.github/workflows/ci.yml` jobs locally | — |

## One-time setup

```bash
pip install -r backend/requirements.txt pytest pyyaml
npm --prefix frontend install
```

Prometheus 2.54.1 and Grafana 11.2.0 (the versions pinned in `docker-compose.yml`) are extracted into `tools/` (gitignored).
Then generate their localhost configs from `monitoring/`:

```bash
python simulation/prepare_monitoring.py
```

Point the backend at the Jira simulator with `backend/.env` (gitignored):

```env
JIRA_BASE_URL=http://127.0.0.1:8090
JIRA_USER_EMAIL=simulator@evcp.local
JIRA_API_TOKEN=local-simulator-token
JIRA_PROJECT_KEY=EVCP
```

Swap in real Jira Cloud values to go live; nothing else changes.

## Start everything

Each of these is also an entry in `.claude/launch.json`.

```bash
python simulation/jira_simulator.py
cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000
cd frontend && npm run dev
tools/prometheus-2.54.1.windows-amd64/prometheus.exe --config.file=tools/local/prometheus.yml --storage.tsdb.path=tools/local/prometheus-data --web.listen-address=127.0.0.1:9090
tools/grafana-v11.2.0/bin/grafana.exe server --homepath tools/grafana-v11.2.0
python simulation/traffic_simulator.py
```

## Jira round trip

1. Create a task on the EVCP Tasks board → issue `EVCP-N` appears on the simulator board.
2. Move it in EVCP (Start / Resolve) → the issue transitions in Jira.
3. Move the card on the simulator board → a `jira:issue_updated` webhook hits `/api/jira/webhook` and the EVCP task follows.

The simulator persists issues in `simulation/jira_sim_store.json` (gitignored). Delete it to reset.

## CI pipeline

```bash
python simulation/run_ci_local.py                       # push to main: full pipeline
python simulation/run_ci_local.py --event pull_request  # PR run
python simulation/run_ci_local.py --job backend-tests   # single job
```

Each run checks out a fresh copy of the working tree into a temp dir and uses an isolated virtualenv, so it neither
disturbs the running dev servers nor touches global Python packages. The `docker-build` and `deploy` jobs are
reported as skipped when Docker isn't installed; with Docker present they run as written.

## GitHub Actions (live, not simulated)

The backend talks to the real repository through `backend/github_service.py`:

- The dashboard's **GitHub Actions** panel lists recent workflow runs with live status. This needs no token, because the repo is public.
- With `GITHUB_TOKEN` set in `backend/.env`, the running platform triggers `.github/workflows/runtime-report.yml`. It does this on startup, from the **Send report** button, and every `GITHUB_REPORT_INTERVAL_MIN` minutes if that's set. Each run publishes a snapshot of volunteers, shifts, tasks and incidents to the run summary, and adds warnings for critical incidents.
- GitHub only dispatches workflows that exist on the target ref (`GITHUB_WORKFLOW_REF`, default `main`). The workflow has to be merged before reports go through.
