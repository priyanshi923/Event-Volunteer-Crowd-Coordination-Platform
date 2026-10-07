Implement **Experiment 4 — Continuous Integration (CI)** for the existing **Event Volunteer & Crowd Coordination Platform**.

### Objective

Add a real GitHub Actions CI pipeline that automatically runs on:

* Push to `main`
* Pull requests targeting `main`

Do **not** redesign the application or modify existing application functionality. Do not remove, reset, or overwrite existing project changes.

### Create

```text
.github/workflows/ci.yml
```

Use this pipeline structure:

```yaml
name: EVCP CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.13"

      - name: Install backend dependencies
        working-directory: backend
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest

      - name: Run backend tests
        working-directory: backend
        env:
          PYTHONPATH: .
        run: pytest -v

  frontend-checks:
    name: Frontend Checks
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci

      - name: Run frontend lint
        working-directory: frontend
        run: npm run lint

      - name: Build frontend
        working-directory: frontend
        run: npm run build

  docker-build:
    name: Docker Build Verification
    runs-on: ubuntu-latest
    needs:
      - backend-tests
      - frontend-checks

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Build backend image
        run: docker build -t evcp-backend:ci ./backend

      - name: Build frontend image
        run: docker build -t evcp-frontend:ci ./frontend
```

### Requirements

1. Inspect the existing repository before modifying anything.
2. Preserve all current application functionality.
3. Do not change the existing Dockerfiles unless absolutely necessary for CI compatibility.
4. Do not add unnecessary dependencies to `backend/requirements.txt`; `pytest` may be installed separately inside CI.
5. Use the existing `frontend/package-lock.json` with `npm ci`.
6. Use Python 3.13 and Node.js 22.
7. Backend tests must execute all existing `test*.py` files through `pytest`.
8. Frontend lint and production build must both succeed.
9. Docker backend and frontend images must build successfully.
10. Do not commit or push changes automatically.
11. After implementation, verify that `.github/workflows/ci.yml` exists and report exactly what was changed.
12. If any existing test, lint, build, or Docker issue prevents CI from succeeding, diagnose the actual issue and make only the minimal required fix.

### Expected final structure

```text
.github/
├── ISSUE_TEMPLATE/
├── pull_request_template.md
└── workflows/
    └── ci.yml
```

### CI flow

```text
GitHub Push / Pull Request
          ↓
   ┌──────┴──────┐
   ↓             ↓
Backend       Frontend
pytest        npm ci
   ↓           ↓
             lint
               ↓
             build
   └──────┬──────┘
          ↓
   Docker Build
          ↓
       PASS ✅
```

This is **Experiment 4 only**. Do not implement CD, deployment, Jira, Prometheus, Grafana, or new application features as part of this task.
