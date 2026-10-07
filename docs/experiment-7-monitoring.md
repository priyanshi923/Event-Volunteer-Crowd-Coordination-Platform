# Experiment 7 — Prometheus + Grafana Monitoring

**Project:** Event Volunteer & Crowd Coordination Platform (EVCP) — DevOps Enabled  
**Curriculum Track:** Experiment 7 (Infrastructure & Application Observability using Prometheus & Grafana)

---

## 1. Aim & Objective

To implement, orchestrate, and verify an end-to-end observability architecture for the **Event Volunteer & Crowd Coordination Platform (EVCP)**:
- Continuous scraping of native HTTP telemetry and real-time business domain metrics from FastAPI via **Prometheus**.
- Automated datasource and dashboard provisioning in **Grafana**.
- Real-time visualization of live crowd staffing, volunteer attendance, shift coverage gaps, incident SLA escalations, request rates (QPS), and latency distributions across a cohesive 4-service **Docker Compose** stack.

---

## 2. Monitoring Architecture & Data Flow

```text
       ┌────────────────────────┐
       │     React Frontend     │ (Host: :3000)
       └───────────┬────────────┘
                   │ HTTP User Actions / REST API Requests
                   ▼
       ┌────────────────────────┐
       │     FastAPI Backend    │ (Host: :8000)
       │  • /health (Probing)   │
       │  • /metrics (Prom)     │
       └───────────┬────────────┘
                   │ Scrape: HTTP GET backend:8000/metrics (Every 10s)
                   ▼
       ┌────────────────────────┐
       │   Prometheus Server    │ (Host: :9090)
       │  • TSDB Time-Series    │
       │  • Target: 'backend'   │
       └───────────┬────────────┘
                   │ PromQL Queries (Proxy: http://prometheus:9090)
                   ▼
       ┌────────────────────────┐
       │   Grafana Dashboard    │ (Host: :3001)
       │  • Pre-wired Source    │
       │  • Interactive Panels  │
       └────────────────────────┘
```

---

## 3. Technologies Used

- **Instrumentator:** `prometheus-fastapi-instrumentator 8.1.0` + `prometheus-client 0.21.1`
- **Time-Series Database:** Prometheus `prom/prometheus:v2.54.1`
- **Analytics & Dashboards:** Grafana `grafana/grafana:11.2.0`
- **Orchestration:** Docker Compose v2.33+ on private bridge network `evcp-network`
- **Storage:** Named persistent volumes `prometheus_data` and `grafana_data`

---

## 4. Real Metrics Implemented (Catalog)

All metrics are populated directly from the application's runtime and SQLite database state:

### A. Business Domain Gauges (Point-in-Time State)
- `evcp_volunteers_total` (Gauge): Total registered volunteers in the database.
- `evcp_volunteers_checked_in` (Gauge): Total volunteers currently checked in on-site.
- `evcp_shifts_active` (Gauge): Total active operational shifts.
- `evcp_coverage_gaps_total` (Gauge): Total unstaffed volunteer slots across shifts.
- `evcp_issues_open` (Gauge): Active unresolved field incidents (`OPEN` / `ACKNOWLEDGED`).
- `evcp_issues_escalated` (Gauge): Incidents that breached SLA timers (`escalation_level > 0`).

### B. Cumulative Event Counters
- `evcp_checkins_total` (Counter): Total successful check-in operations.
- `evcp_checkouts_total` (Counter): Total successful check-out operations.
- `evcp_incidents_reported_total` (Counter): Total incident reports logged.
- `evcp_auto_assignments_total` (Counter): Total 2-stage automated assignment batches run.

### C. HTTP & Application Runtime Metrics
- `http_requests_total` (Counter): Partitioned by `handler`, `status`, `method`, and `service`.
- `http_request_duration_seconds` (Histogram): Request latency buckets (`le`) for P95 and average computation.
- `http_requests_inprogress` (Gauge): Active concurrent requests being processed.

---

## 5. Provisioning & Configuration

### A. Prometheus Scraping Configuration (`monitoring/prometheus/prometheus.yml`)
```yaml
global:
  scrape_interval: 10s
  evaluation_interval: 10s

scrape_configs:
  - job_name: "event-volunteer-backend"
    metrics_path: "/metrics"
    scrape_interval: 10s
    static_configs:
      - targets: ["backend:8000"]
        labels:
          environment: "production"
          service: "event-volunteer-api"
```

### B. Grafana Datasource Provisioning (`monitoring/grafana/provisioning/datasources/datasource.yml`)
```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: "10s"
      httpMethod: "POST"
```

### C. Grafana Dashboard Provisioning (`monitoring/grafana/provisioning/dashboards/`)
- **Provider:** `dashboard.yml` automatically scans and loads dashboards from `/etc/grafana/provisioning/dashboards`.
- **Dashboard JSON:** `evcp_dashboard.json` (`UID: evcp-operations-telemetry`).
- **Configured Panels & Rows:**
  1. *Row 1: Event Operations & Staffing Overview*
     - Stat: Total Volunteers Registered (`evcp_volunteers_total`)
     - Stat: Checked-In Volunteers (`evcp_volunteers_checked_in`)
     - Stat: Active Shifts (`evcp_shifts_active`)
     - Stat: Staffing Coverage Gaps (`evcp_coverage_gaps_total`)
     - Stat: Open Issues (`evcp_issues_open`)
     - Stat: SLA Escalated Incidents (`evcp_issues_escalated`)
  2. *Row 2: API Performance, Request Rates & Reliability*
     - Timeseries: HTTP Request Rate by Endpoint QPS (`sum by (handler) (rate(http_requests_total[1m]))`)
     - Timeseries: API Request Latency P95 & Avg (`histogram_quantile(0.95, ...)` & `sum(rate(duration_sum))/sum(rate(duration_count))`)
  3. *Row 3: Operational Actions & Crowd Incident Dynamics*
     - Timeseries (Bars): Cumulative Field Operations (`evcp_checkins_total`, `evcp_checkouts_total`, `evcp_auto_assignments_total`)
     - Timeseries (Step): Incident & SLA Escalation Dynamics (`evcp_incidents_reported_total`, `evcp_issues_escalated`)

---

## 6. Verification Results

| Dimension | Probe / Command | Status | Result / Output Observed |
|---|---|:---:|---|
| **Backend `/metrics`** | `GET http://localhost:8000/metrics` | **VERIFIED** | HTTP 200 (Prometheus text exposition format) |
| **Backend `/health`** | `GET http://localhost:8000/health` | **VERIFIED** | `HTTP 200 {"status":"healthy",...}` |
| **Prometheus Target** | `GET http://localhost:9090/api/v1/targets` | **VERIFIED** | Target `event-volunteer-backend` is **UP (Health: up)** |
| **Prometheus Queries** | `GET http://localhost:9090/api/v1/query?query=...` | **VERIFIED** | Real values: `volunteers=10`, `checked_in=6`, `shifts=6`, `gaps=9`, `issues=3` |
| **Grafana Accessibility**| `GET http://localhost:3001/api/health` | **VERIFIED** | HTTP 200 (`{"database":"ok"}`) |
| **Grafana Datasource** | `GET http://localhost:3001/api/datasources` | **VERIFIED** | Default datasource `Prometheus` active |
| **Grafana Dashboard** | `GET http://localhost:3001/api/dashboards/uid/evcp-operations-telemetry` | **VERIFIED** | Dashboard loaded successfully with 13 panels/rows |
| **Automated Tests** | `python -m pytest -q` | **VERIFIED** | **14 passed in 9.67s (100% pass rate)** |
| **Docker Compose** | `docker compose ps` | **VERIFIED** | All 4 containers running and healthy |

---

## 7. How to Run & Access the Monitoring Stack

```bash
# 1. Start all services in the background
docker compose up -d

# 2. Check service status
docker compose ps
```

### URLs & Ports:
- **FastAPI Backend & API Docs:** `http://localhost:8000/docs`
- **Backend Prometheus Metrics:** `http://localhost:8000/metrics`
- **React Frontend UI:** `http://localhost:3000`
- **Prometheus Web Console:** `http://localhost:9090`
- **Grafana Dashboard UI:** `http://localhost:3001`
  - *Default Credentials:* User `admin` / Password `admin`
  - *Direct Dashboard URL:* `http://localhost:3001/d/evcp-operations-telemetry/evcp-operations-telemetry`

---

## 8. Manual Evidence Required (Screenshots for Practical Demo)

Capture the following 4 screenshots for your submission:

1. **Prometheus Targets Page:**
   - URL: `http://localhost:9090/targets`
   - Highlights: Shows `event-volunteer-backend (1/1 up)` with state **UP** in green.
2. **Prometheus Graph Query:**
   - URL: `http://localhost:9090/graph`
   - Highlights: Query `evcp_volunteers_checked_in` or `http_requests_total` returning graph and scalar table values.
3. **Grafana Interactive Dashboard:**
   - URL: `http://localhost:3001/d/evcp-operations-telemetry/evcp-operations-telemetry`
   - Highlights: Displays the 6 KPI stat tiles (Volunteers, Checked-In, Shifts, Gaps, Issues, SLA Escalated) and the QPS / Latency graphs.
4. **Docker Compose Running Containers:**
   - Terminal Command: `docker compose ps`
   - Highlights: Shows all four services (`evcp-frontend`, `evcp-backend`, `evcp-prometheus`, `evcp-grafana`) with status `Up (healthy)`.
