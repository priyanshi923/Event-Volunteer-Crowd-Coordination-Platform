# Experiment 5 — Continuous Deployment (CD)

## Project

Event Volunteer & Crowd Coordination Platform — DevOps Enabled

## Objective

Implement and locally verify **Experiment 5: Continuous Deployment** using the existing project.

The project already has:

* GitHub repository
* Working backend and frontend
* Dockerfiles
* Docker Compose
* Prometheus + Grafana monitoring
* Automated CI pipeline
* Backend tests passing
* Frontend lint/build passing
* Docker image builds passing

Do NOT redesign the application or add unrelated functionality.

The goal is to extend the existing CI pipeline into a genuine **CI → CD workflow** where a successful build automatically deploys the latest application containers.

---

# 1. First inspect the existing project

Before making changes, inspect:

* Existing GitHub Actions/Jenkins CI configuration
* `docker-compose.yml`
* Backend Dockerfile
* Frontend Dockerfile
* Existing health endpoints
* Existing Prometheus/Grafana configuration
* Existing environment configuration
* Existing tests
* Existing `.gitignore`
* Existing `.env.example`

Do not duplicate existing functionality.

Preserve the current application architecture and existing working behavior.

---

# 2. CD architecture

Implement this deployment flow:

```text
Developer Push
      ↓
GitHub
      ↓
CI Pipeline
      ↓
Backend Tests
      ↓
Frontend Lint + Build
      ↓
Docker Image Build
      ↓
CI SUCCESS
      ↓
CD Deployment
      ↓
Docker Compose
      ↓
Restart/Update Services
      ↓
Health Check
      ↓
Deployment SUCCESS
```

The deployment should use the existing Docker Compose application.

---

# 3. Deployment strategy

Use a **self-hosted/local deployment approach** suitable for a college practical demonstration.

Do NOT introduce paid cloud infrastructure.

Do NOT require AWS, Azure, GCP, Kubernetes, or any paid service.

The deployment target should be a machine capable of running Docker Compose.

The deployment process should:

1. Obtain the latest project version.
2. Build/update the required Docker images.
3. Start or recreate the application containers.
4. Keep the existing services working.
5. Perform health checks.
6. Report deployment success/failure.

Use Docker Compose rather than manually starting every container.

---

# 4. Create/update the CD workflow

Extend the existing CI/CD configuration with a separate deployment stage/job.

Prefer GitHub Actions if the existing project already uses GitHub Actions.

The workflow should conceptually contain:

```text
CI
 ├── Checkout
 ├── Backend tests
 ├── Frontend lint
 ├── Frontend build
 └── Docker build
          ↓
       CD
 ├── Prepare deployment
 ├── Docker Compose build/update
 ├── Docker Compose up
 ├── Health checks
 └── Deployment result
```

CD must only execute when CI succeeds.

Do NOT deploy if tests or builds fail.

Use an appropriate dependency such as:

```yaml
needs: ci
```

or the equivalent mechanism if the existing workflow structure differs.

---

# 5. Docker Compose deployment

Use the existing `docker-compose.yml`.

Do not create a second competing Compose configuration unless absolutely necessary.

The deployment should use commands equivalent to:

```bash
docker compose pull
docker compose build
docker compose up -d
```

Use only the commands actually required by the existing project.

After deployment, verify:

```bash
docker compose ps
```

All required services should reach a healthy/running state.

Do not unnecessarily destroy persistent application data.

---

# 6. Health checks

Use the existing backend health/root endpoint if available.

If the backend already has a suitable health endpoint, reuse it.

If a health endpoint is genuinely missing, add a minimal endpoint such as:

```text
GET /health
```

returning a simple success response.

Do NOT add unnecessary application features.

The deployment workflow should wait briefly for services to start and then verify that the backend responds successfully.

Example concept:

```text
Deployment
    ↓
Wait for containers
    ↓
GET /health
    ↓
HTTP 200
    ↓
Deployment successful
```

If the health check fails:

```text
Deployment
    ↓
Health check ❌
    ↓
CD FAILED
```

The workflow must clearly report failure.

---

# 7. Deployment verification

After deployment, verify:

### Containers

```bash
docker compose ps
```

### Backend

Verify the backend endpoint responds.

### Frontend

Verify the frontend is reachable using the existing configured port.

### Monitoring

Verify that the existing Prometheus and Grafana services remain accessible if they are part of the Compose stack.

Do not change existing monitoring functionality unnecessarily.

---

# 8. Deployment evidence

Create a concise deployment verification document:

```text
docs/experiment-5-cd.md
```

It should contain:

## Experiment 5 — Continuous Deployment

### Objective

Short explanation of the CD objective.

### Architecture

```text
GitHub
   ↓
CI
   ↓
Tests
   ↓
Docker Build
   ↓
CD
   ↓
Docker Compose
   ↓
Running Containers
   ↓
Health Check
```

### Tools

* GitHub Actions
* Docker
* Docker Compose
* FastAPI
* React
* Existing monitoring stack

### Deployment Steps

Document the actual commands/workflow used.

### Verification

Record:

* CI result
* Docker build result
* Container status
* Backend health result
* Frontend availability
* Monitoring availability if applicable

### Failure Handling

Explain that CD runs only after successful CI and that failed health checks cause deployment failure.

### Result

State that the application was successfully deployed through the automated CI/CD workflow.

Do not fabricate results. Only document results that were actually verified.

---

# 9. Testing the CD pipeline

Perform an actual end-to-end demonstration.

### Test A — Successful deployment

Make a small harmless application change.

Then:

```text
git add .
git commit -m "ci: verify continuous deployment"
git push
```

Verify:

```text
GitHub
 ↓
CI starts
 ↓
Tests pass
 ↓
Frontend checks pass
 ↓
Docker build passes
 ↓
CD starts
 ↓
Docker Compose deployment
 ↓
Health check passes
 ↓
Deployment succeeds
```

### Test B — Failed CI blocks CD

Temporarily introduce a controlled test failure.

Push it.

Expected:

```text
CI ❌
 ↓
CD does NOT execute
```

Then restore the test.

Do not leave the repository broken.

### Test C — Health check

Verify that the deployed backend responds successfully.

---

# 10. Important constraints

Do NOT:

* Add new agents
* Redesign the frontend
* Rewrite the backend
* Add Kubernetes
* Add cloud infrastructure
* Add unnecessary databases
* Replace Docker Compose
* Remove Prometheus/Grafana
* Break existing CI
* Change existing API contracts unnecessarily
* Add unrelated application features

This is a DevOps experiment, not an application redesign.

Keep the implementation minimal, reliable, and demonstrable.

---

# 11. Git commit

After all implementation and verification is complete, prepare the project for commit.

Recommended commit message:

```text
ci: implement continuous deployment pipeline
```

Do NOT execute Git commands unless necessary for verification. I will handle the final Git commit/push myself.

---

# 12. Final response required

After implementation, give me a concise report containing:

1. Files created/modified
2. CD workflow explanation
3. Exact deployment flow
4. Commands used for verification
5. CI result
6. CD result
7. Container status
8. Health-check result
9. Frontend result
10. Monitoring result
11. Any limitations or issues
12. Recommended commit message

Most importantly, distinguish between:

```text
IMPLEMENTED
VERIFIED
NOT VERIFIED
```

Do not claim something is working unless it was actually tested.

The final implementation should make Experiment 5 visibly demonstrable as:

```text
GitHub
   ↓
CI
   ↓
Tests
   ↓
Build
   ↓
CD
   ↓
Docker Compose
   ↓
Running EVCP
   ↓
Health Check
```

Keep the solution simple and compatible with the project's existing architecture.
