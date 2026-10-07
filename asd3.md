Now implement **Phase 1, Step 2: Prometheus Metrics & Backend Monitoring Foundation** for the existing Event Volunteer & Crowd Coordination Platform.

This is preparation for **Experiment 7: Implement monitoring using Prometheus / Grafana / Nagios.**

IMPORTANT:

* Do NOT rebuild the application.
* Do NOT modify existing frontend UI.
* Do NOT change existing business logic or assignment algorithms.
* Do NOT remove or rename existing API endpoints.
* Preserve all existing functionality.
* Make only the changes required for monitoring and environment configuration.
* Run the existing tests after making changes.

### 1. Add Prometheus instrumentation

Use a standard Python Prometheus solution compatible with the existing FastAPI application.

Prefer:

`prometheus-fastapi-instrumentator`

unless the existing architecture makes `prometheus-client` more appropriate.

Add the required dependency to:

`backend/requirements.txt`

Do not add unnecessary monitoring libraries.

### 2. Expose `/metrics`

Update the existing FastAPI application so that:

`GET /metrics`

returns Prometheus-compatible metrics.

The endpoint must be accessible without breaking the existing API.

### 3. Collect HTTP/application metrics

Expose useful metrics including:

* HTTP request count
* HTTP request duration/latency
* HTTP response status codes
* Request rate / throughput
* Error responses

Use standard Prometheus metric naming where possible.

### 4. Add business metrics

Create useful application-level Prometheus metrics for the Event Volunteer & Crowd Coordination Platform.

At minimum include:

* Total volunteers
* Active/check-in volunteers
* Active shifts
* Open issues
* Escalated issues
* Coverage gaps

These metrics must reflect the actual database/application state.

DO NOT create fake/static values.

Where appropriate, use gauges for current state and counters for cumulative events.

### 5. Add health endpoint

If a health endpoint does not already exist, add:

`GET /health`

It should return a simple successful JSON response indicating that the backend is running.

Do not duplicate an existing health endpoint if one already exists.

### 6. Environment configuration

Externalize configuration that will later be required by Docker Compose.

At minimum support environment variables for:

* HOST
* PORT
* DATABASE_URL
* CORS origins

Preserve the current local-development behavior if these variables are not provided.

Do not hard-code Docker-specific values into the application.

### 7. Database compatibility

The current application uses SQLite.

Do NOT migrate the database to PostgreSQL or another database in this step.

Make sure the existing SQLite development setup continues working.

### 8. Testing

Add monitoring tests where appropriate.

Verify:

`GET /health`

works.

Verify:

`GET /metrics`

returns Prometheus-formatted output.

Verify the existing application tests still pass.

Do not remove or weaken any existing tests.

### 9. Documentation

Create:

`docs/MONITORING.md`

Briefly document:

* What Prometheus does in this project
* `/metrics`
* `/health`
* HTTP metrics
* Business metrics
* How Prometheus will later scrape the backend
* How Grafana will later visualize these metrics

Do NOT create the Grafana dashboard yet.

Do NOT create Docker Compose yet.

Do NOT create CI/CD yet.

### 10. Final verification

Run the relevant backend tests and existing E2E tests.

Report:

1. Files changed/created
2. Dependencies added
3. Metrics exposed
4. Health endpoint status
5. Test results
6. Any issues or compatibility concerns

IMPORTANT:
Do not commit or push changes to GitHub automatically.

Stop after this step and wait for my next instruction.
