# Experiment 7 — Prometheus + Grafana Monitoring

Experiment 6 (Jira) is now COMPLETE. Do not modify, recreate, or expand the Jira setup.

Now work ONLY on **Experiment 7 — Monitoring** for the existing Event Volunteer & Crowd Coordination Platform.

## Objective

Implement and verify a real monitoring stack using:

**FastAPI Application → Prometheus → Grafana**

Do NOT add Nagios. Prometheus + Grafana is sufficient.

The monitoring must use **real metrics from the existing application**, not mock/static data.

---

## Step 1 — Inspect Before Changing Anything

First inspect the existing project and determine:

1. Whether `/metrics` already exists in the FastAPI backend.
2. Whether `prometheus_client` or another Prometheus library is already installed.
3. Whether `prometheus.yml` already exists.
4. Whether Prometheus is already included in `docker-compose.yml`.
5. Whether Grafana is already included in `docker-compose.yml`.
6. Whether any Grafana dashboard/provisioning files already exist.
7. Whether existing application/business metrics are already implemented.
8. Whether Docker Compose currently starts the application successfully.

Do NOT duplicate existing implementation.

---

## Step 2 — Implement Application Metrics

If missing, expose a Prometheus `/metrics` endpoint in the existing FastAPI backend.

Implement useful real application metrics, including where practical:

### HTTP/Application metrics

* HTTP request count
* HTTP request latency
* HTTP error count/rate
* Requests per second / request rate

### Event/Volunteer metrics

* Total volunteers
* Active volunteers
* Checked-in volunteers
* Active shifts
* Open operational issues
* Escalated issues
* Zone coverage / coverage gaps

Use appropriate Prometheus metric types such as Counter, Gauge, and Histogram.

Metrics must be calculated from the existing application/data where possible.

Do NOT create fake hard-coded values just to make Grafana panels look populated.

---

## Step 3 — Prometheus

Configure Prometheus to scrape the FastAPI application's `/metrics` endpoint.

Add or update:

`prometheus.yml`

Use the correct Docker Compose service name/network configuration rather than relying on localhost from inside the Prometheus container.

Verify that:

* Prometheus starts successfully.
* The FastAPI target is reachable.
* The target is shown as **UP**.
* Metrics can be queried from Prometheus.

---

## Step 4 — Grafana

Add Grafana to the existing Docker Compose monitoring stack if it is not already present.

Configure Prometheus as the Grafana data source.

Create a proper Grafana dashboard using real Prometheus queries.

The dashboard should contain useful panels such as:

### Application

* Request rate
* Request count
* Response latency
* Error rate

### Event operations

* Total volunteers
* Active/check-in volunteers
* Active shifts
* Open issues
* Escalated issues
* Zone coverage

### System/container monitoring

If the current project already has a suitable exporter available, include:

* CPU usage
* Memory usage
* Container status

Do NOT introduce unnecessary infrastructure solely for these metrics if it significantly complicates the project.

---

## Step 5 — Make Grafana Genuinely Interactive

The dashboard must be a real Grafana dashboard, not an image or static HTML page.

Include useful Grafana functionality such as:

* Time-range selection
* Auto-refresh
* Graph/time-series panels
* Stat panels
* Panel inspection/tooltips
* Useful dashboard organization

If appropriate, add a dashboard variable/filter, but do not overcomplicate it.

---

## Step 6 — Docker Compose Integration

Integrate the monitoring services with the EXISTING Docker Compose setup.

The intended architecture is:

```text
React Frontend
      ↓
FastAPI Backend
      ↓
Application Metrics (/metrics)
      ↓
Prometheus
      ↓
Grafana
```

Do not break the existing frontend/backend/database services.

Verify that the complete stack starts using the existing Docker Compose workflow.

---

## Step 7 — Testing & Verification

Perform actual verification.

Check:

1. Application starts.
2. `/metrics` responds successfully.
3. Prometheus starts.
4. Prometheus can scrape the application.
5. Prometheus target is UP.
6. Prometheus queries return real metrics.
7. Grafana starts.
8. Grafana connects to Prometheus.
9. Dashboard loads successfully.
10. Dashboard panels display real data.
11. Metrics change when application endpoints are used.
12. Existing application tests still pass.
13. Existing Docker/Compose functionality is not broken.

Generate some legitimate application traffic if necessary so request/latency/error metrics have observable data.

---

## Step 8 — Documentation

Create/update:

`docs/experiment-7-monitoring.md`

Document:

* Experiment 7 aim
* Monitoring architecture
* Technologies used
* Metrics implemented
* Prometheus configuration
* Grafana configuration
* Docker Compose integration
* Testing performed
* Verification results
* Dashboard panels
* How to run the monitoring stack
* URLs/ports for Prometheus and Grafana
* Evidence/screenshots that should be captured

Do not claim anything was verified unless you actually verify it.

---

## Step 9 — Final Report

At the end, provide a concise **Experiment 7 Verification Report** containing:

### 1. Implementation status

What was already present and what you added.

### 2. Files changed/created

List the exact files.

### 3. Metrics implemented

List the actual metrics.

### 4. Prometheus verification

Show whether the application target is UP and metrics are queryable.

### 5. Grafana verification

Show whether Grafana connects to Prometheus and the dashboard loads.

### 6. Docker Compose verification

Confirm all relevant services start successfully.

### 7. Tests

List tests/commands executed and their results.

### 8. Manual evidence required

Tell me exactly which screenshots I should take for the Experiment 7 practical/demo.

### 9. Remaining issues

Clearly state anything that is still incomplete.

---

# IMPORTANT CONSTRAINTS

* This is **Experiment 7 only**.
* Do NOT modify Jira.
* Do NOT create new application features unrelated to monitoring.
* Do NOT add new agents or unnecessary architecture.
* Do NOT replace the existing application architecture.
* Do NOT use fake/static metrics.
* Do NOT break existing Docker, CI/CD, frontend, backend, or database functionality.
* Reuse existing code/configuration wherever possible.
* Keep the implementation simple enough to finish and demonstrate.
* Prioritize **working + verifiable + demo-ready** over unnecessary sophistication.

At the end, stop and give me the complete Experiment 7 Verification Report.
