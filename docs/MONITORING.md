# Prometheus Metrics & Backend Monitoring Architecture

**Project:** Event Volunteer & Crowd Coordination Platform  
**Target:** Experiment 7 (Prometheus / Grafana / Nagios Monitoring)

---

## 1. Overview & Role of Prometheus

In this platform, **Prometheus** serves as the time-series metric aggregation engine. It continuously pulls (scrapes) operational and business telemetries from the FastAPI backend at regular intervals (typically 5s–15s).

```
┌─────────────────────────────────┐
│        FastAPI Backend          │
│   (Instrumentator & Custom DB)  │
│   • /health (Readiness)         │
│   • /metrics (Exposition)       │
└────────────────┬────────────────┘
                 │ Scrape (HTTP GET /metrics)
┌────────────────▼────────────────┐
│      Prometheus Server          │
│   • Time-series Storage         │
│   • PromQL Query Engine         │
└────────────────┬────────────────┘
                 │ PromQL Queries
┌────────────────▼────────────────┐
│      Grafana Dashboard          │
│   (Visualizations & Alerts)     │
└─────────────────────────────────┘
```

---

## 2. Core Endpoints

### `GET /health`
- **Purpose:** Liveness and readiness probe for container orchestrators, load balancers, and monitoring agents.
- **Response Format:**
  ```json
  {
    "status": "healthy",
    "service": "Event Volunteer & Crowd Coordination API",
    "timestamp": "2026-10-07T17:49:34.287965"
  }
  ```

### `GET /metrics`
- **Purpose:** Standard Prometheus exposition format exposing both HTTP runtime telemetries and application business domain metrics.
- **Content-Type:** `text/plain; version=0.0.4; charset=utf-8`

---

## 3. Metric Catalog

### A. HTTP & Application Runtime Metrics
Instrumented automatically via `prometheus-fastapi-instrumentator`:

| Metric Name | Type | Description |
|---|---|---|
| `http_requests_total` | Counter | Total count of HTTP requests partitioned by `handler`, `status`, and `method`. |
| `http_request_duration_seconds` | Histogram | Request latency distributions and percentile buckets. |
| `http_requests_inprogress` | Gauge | Instantaneous number of concurrent HTTP requests currently being processed. |

### B. Business Domain Metrics (Gauges)
Dynamically populated directly from the platform's SQLite database state on every scrape:

| Metric Name | Type | Description |
|---|---|---|
| `evcp_volunteers_total` | Gauge | Total registered volunteers in the system. |
| `evcp_volunteers_checked_in` | Gauge | Total volunteers currently checked in on-site. |
| `evcp_shifts_active` | Gauge | Total operational shifts defined for active events. |
| `evcp_issues_open` | Gauge | Unresolved incidents (`OPEN` or `ACKNOWLEDGED`). |
| `evcp_issues_escalated` | Gauge | Incidents that breached SLA timers (`escalation_level > 0`). |
| `evcp_coverage_gaps_total` | Gauge | Total volunteer staffing gaps across active shifts. |

### C. Cumulative Event Counters
Incremented in real-time as coordinators and volunteers perform key actions:

| Metric Name | Type | Description |
|---|---|---|
| `evcp_checkins_total` | Counter | Total successful volunteer check-in operations. |
| `evcp_checkouts_total` | Counter | Total volunteer check-out operations completed. |
| `evcp_incidents_reported_total` | Counter | Total incident tickets created by volunteers or coordinators. |
| `evcp_auto_assignments_total` | Counter | Total auto-assignment optimization batches executed. |

---

## 4. Environment Configuration

The backend is configured to support containerized and multi-environment deployments via environment variables:

- `HOST` (Default: `127.0.0.1`): Server host binding interface.
- `PORT` (Default: `8000`): HTTP port.
- `DATABASE_URL` (Default: `sqlite:///./event_platform.db`): SQLAlchemy database connection string.
- `CORS_ORIGINS` (Default: `*`): Comma-delimited list of permitted CORS origins (e.g. `http://localhost:5173,http://localhost:3000`).

---

## 5. Upcoming Integration Path

1. **Prometheus Scraping Configuration (`prometheus.yml`):**
   ```yaml
   scrape_configs:
     - job_name: "evcp-backend"
       scrape_interval: 10s
       static_configs:
         - targets: ["backend:8000"]
   ```
2. **Grafana Visualization (Phase 4):**
   - **Operational View:** Request Rate (QPS), Latency percentiles (P95, P99), 5xx Error Spike alarms.
   - **Crowd & Staffing Command View:** Volunteer fill-rate gauge, Real-time Checked-in vs. Registered ratio, SLA Escalation heatmaps.
