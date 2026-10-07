# Experiment 6 — Agile Project Management Using Jira

**Project:** Event Volunteer & Crowd Coordination Platform (EVCP) — DevOps Enabled  
**Curriculum Track:** Experiment 6 (Agile Software Development & Scrum/Kanban Tracking using Atlassian Jira)

---

## 1. Aim & Objective

To structure, manage, and track the development lifecycle of the **Event Volunteer & Crowd Coordination Platform (EVCP)** using **Agile Software Development** principles and the **Scrum / Kanban Framework** in Atlassian Jira.

This encompasses:
- Formulating a high-level **Epic hierarchy** aligned with real application domain modules.
- Decomposing functional requirements into actionable **User Stories** (`As a <role>, I want <goal>, so that <benefit>`) with **Fibonacci Story Points** and explicit **Acceptance Criteria**.
- Establishing a 4-tier lifecycle workflow: `To Do` ➔ `In Progress` ➔ `Testing` ➔ `Done`.
- Structuring a realistic **4-Sprint Release Roadmap** reflecting actual incremental development.
- Logging and tracking technical debt and regressions as **Bugs** and **Technical Subtasks**.
- Demonstrating dual-mode execution via **Scrum Sprints** and continuous **Kanban Board** flow.
- Analyzing velocity and burndown metrics via Agile reporting tools.

---

## 2. Jira Project Specification

| Attribute | Value / Configuration |
|---|---|
| **Project Name** | `EVCP — Event Volunteer & Crowd Coordination Platform` |
| **Project Type** | Software Development (Scrum template with Kanban backlog view) |
| **Project Key** | `EVCP` |
| **Lead / Product Owner** | Event Platform Lead / Coordinator |
| **Default Estimation** | Story Points (Fibonacci sequence: 1, 2, 3, 5, 8, 13) |
| **Workflow Scheme** | `To Do` ➔ `In Progress` ➔ `Testing` ➔ `Done` |

---

## 3. Agile Epics Catalog

All development items are mapped to 9 real, active domain epics:

| Epic Key | Epic Name | Scope & Domain Description |
|---|---|---|
| **EVCP-E1** | **Project Foundation** | Establish repository structure, FastAPI skeleton, SQLite database engine, React 19/Vite setup, and base styling tokens. |
| **EVCP-E2** | **Event Management** | Event entity lifecycle, sector/zone declarations (Entry Gate, Medical Tent, Main Stage), role definitions, and coordinator context. |
| **EVCP-E3** | **Volunteer Management** | Self-serve onboarding, skill taxonomy (CPR, Crowd Control), explicit availability slot declarations, and contact management. |
| **EVCP-E4** | **Intelligent Assignment Engine** | Mathematical 2-stage matching: Stage 1 hard constraints (availability, 8h cap, 30m turnaround buffer) & Stage 2 100-pt soft scoring. |
| **EVCP-E5** | **Attendance & Operations** | 1-click volunteer check-in/check-out, automatic session hour computation, no-show detection with 15m grace period, and status synchronization. |
| **EVCP-E6** | **Incident & SLA Escalation** | Field issue logging, specialized coordinator auto-routing, and automated 4-tier SLA escalation loop (Zone Lead ➔ Event Director). |
| **EVCP-E7** | **Coordinator Command Center** | Operational overview dashboard: staffing gaps, real-time check-in counters, Kanban task dispatch board, and broadcast announcements. |
| **EVCP-E8** | **DevOps & Containerization** | Docker containerization, multi-service Docker Compose orchestration, volume persistence, and GitHub Actions CI/CD automation. |
| **EVCP-E9** | **Observability & Monitoring** | Prometheus metrics instrumentation (`/metrics`), container health probes (`/health`), and Grafana analytical dashboard provisioning. |

---

## 4. Complete User Stories Backlog

### Epic 1: Project Foundation
- **EVCP-1: Backend API Skeleton Setup**
  - *User Story:* As a developer, I want to set up the FastAPI application with Uvicorn and Pydantic v2 schemas, so that the platform provides reliable RESTful service endpoints.
  - *Story Points:* `3` | *Priority:* `High`
  - *Acceptance Criteria:* Root API returns JSON; CORS middleware configured; OpenAPI docs available at `/docs`.
- **EVCP-2: Frontend Single Page Application Setup**
  - *User Story:* As a developer, I want to configure the React 19 and Vite development environment with Vanilla CSS tokens, so that users experience a responsive, modern UI.
  - *Story Points:* `3` | *Priority:* `High`
  - *Acceptance Criteria:* Vite dev server runs cleanly; dark-mode design system loaded; SPA entry point active.
- **EVCP-3: Relational Database & ORM Initialization**
  - *User Story:* As a developer, I want to initialize SQLAlchemy 2.0 with SQLite and auto-reflection, so that event and volunteer data persists reliably across sessions.
  - *Story Points:* `3` | *Priority:* `High`
  - *Acceptance Criteria:* `event_platform.db` initializes with foreign key constraints and declarative base models.

### Epic 2: Event Management
- **EVCP-4: Create and Configure Events**
  - *User Story:* As an event organizer, I want to create and configure event records with target volunteer headcounts, so that operational resources are tracked against goals.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Form validates name, dates, location, volunteer capacity; computes assigned count vs target.
- **EVCP-5: Configure Operational Zones & Roles**
  - *User Story:* As an event organizer, I want to define specialized zones (Entry Gate, Medical Tent, Main Stage) and operational roles, so that volunteers can be assigned to designated event sectors.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Zones and roles link to events; shift assignments inherit zone security tags.

### Epic 3: Volunteer Management
- **EVCP-6: Volunteer Self-Serve Registration Portal**
  - *User Story:* As a field volunteer, I want to register my profile with skills, emergency contacts, and preferred roles, so that I can be scheduled for event operations.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Validation guards email uniqueness; supports multiple skill tokens and zone preferences.
- **EVCP-7: Explicit Availability Window Management**
  - *User Story:* As a volunteer, I want to declare my day and time availability windows, so that the platform never schedules me during unavailable hours.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Day-of-week, start-time, and end-time records persist in `volunteer_availability` table.

### Epic 4: Intelligent Assignment Engine
- **EVCP-8: Hard-Constraint Volunteer Filtering Engine**
  - *User Story:* As a coordinator, I want shifts to automatically enforce hard constraints (availability, mandatory qualifications, 8-hour daily caps, 30m turnaround buffers, and dropout immunity), so that scheduling complies with labor safety and qualification standards.
  - *Story Points:* `8` | *Priority:* `Highest`
  - *Acceptance Criteria:* Ineligible candidates rejected with descriptive constraint violation codes.
- **EVCP-9: 100-Point Rule-Based Soft Scoring & Scarcity Allocation**
  - *User Story:* As a coordinator, I want candidates scored across skill match (30pts), preferences (15pts), workload fairness (20pts), zone priority (25pts), and historical reliability (10pts), with scarce skills allocated first, so that critical safety roles are filled optimally.
  - *Story Points:* `8` | *Priority:* `Highest`
  - *Acceptance Criteria:* Deterministic scoring breakdown returned; scarcity sorting prevents talent starvation.
- **EVCP-10: Dropout Replacement & Surplus-to-Deficit Rebalancing**
  - *User Story:* As a coordinator, I want immediate replacement suggestions when a volunteer drops out, and automated suggestions to shift surplus volunteers to understaffed zones, so that sudden staffing gaps are mitigated.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Single-click replacement assignment; rebalance transfer does not penalize volunteer with dropout mark.

### Epic 5: Attendance & Operations
- **EVCP-11: Volunteer Check-In & Status Synchronization**
  - *User Story:* As a volunteer/coordinator, I want to record on-site check-in with a single click, so that real-time staffing presence is tracked on the coordinator dashboard.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Updates volunteer state to `Checked In`; prevents duplicate active check-ins (HTTP 400); scopes to the active shift.
- **EVCP-12: Volunteer Check-Out & Working Hours Auditing**
  - *User Story:* As a volunteer/coordinator, I want to check out at the end of a shift, so that total hours worked are computed and accumulated into profile statistics.
  - *Story Points:* `3` | *Priority:* `Medium`
  - *Acceptance Criteria:* Calculates exact decimal duration; updates `total_hours_worked` and `completed_shifts`.
- **EVCP-13: Automated Shift No-Show Detection**
  - *User Story:* As a coordinator, I want volunteers who fail to check in within 15 minutes of shift start to be flagged as no-shows, so that replacement workflows can be triggered immediately.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Background task evaluates active shifts; 15m grace period strictly respected; past shifts protected.

### Epic 6: Issue Management & Escalation
- **EVCP-14: Field Incident Reporting & Specialized Routing**
  - *User Story:* As a field volunteer or coordinator, I want to submit urgent incident reports that automatically route to the responsible lead (First Aid, Security, Operations), so that critical field problems are acknowledged without delay.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Incidents categorized with priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`); auto-assigned to designated lead.
- **EVCP-15: Time-Based 4-Tier SLA Escalation Chain**
  - *User Story:* As an event director, I want unacknowledged critical incidents to escalate through a 4-tier chain (Zone Lead ➔ Sector Supervisor ➔ Head of Operations ➔ Event Director), so that unresolved emergencies receive executive oversight.
  - *Story Points:* `8` | *Priority:* `Highest`
  - *Acceptance Criteria:* Background runner increments escalation level on SLA breach; explicit coordinator acknowledgement halts escalation.

### Epic 7: Coordinator Command Center
- **EVCP-16: Live Operational Command Dashboard**
  - *User Story:* As an event coordinator, I want a unified real-time dashboard displaying checked-in headcount, shift coverage percentage, open staffing gaps, and unresolved incidents, so that I maintain total situational awareness.
  - *Story Points:* `8` | *Priority:* `High`
  - *Acceptance Criteria:* Real-time metric cards; quick links to rebalancing, auto-assign, and emergency alerts.
- **EVCP-17: Operational Kanban Task Dispatch Board**
  - *User Story:* As a coordinator, I want to create, prioritize, and dispatch field tasks across zones using a Kanban board, so that volunteers can self-assign or accept ad-hoc directives.
  - *Story Points:* `5` | *Priority:* `Medium`
  - *Acceptance Criteria:* Visual columns for `OPEN`, `IN_PROGRESS`, `RESOLVED`; zone and priority filters.

### Epic 8: DevOps & Deployment
- **EVCP-18: Docker Containerization of Services**
  - *User Story:* As a DevOps engineer, I want hardened Dockerfiles for backend (Python 3.13-slim, unprivileged user) and frontend (multi-stage Node/Nginx), so that the application executes consistently in any container environment.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Images build under 1GB; unprivileged runtime security (`appuser`); health probes integrated.
- **EVCP-19: Docker Compose Multi-Service Orchestration**
  - *User Story:* As a DevOps engineer, I want a 4-service Docker Compose topology with named volume persistence, bridge networking, and startup dependency ordering, so that the complete platform boots with one command.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* `frontend`, `backend`, `prometheus`, `grafana` services communicate via service DNS; persistent database volume preserved.
- **EVCP-20: Automated CI Pipeline (GitHub Actions)**
  - *User Story:* As a developer, I want a GitHub Actions CI pipeline executing automated backend tests, frontend linting, and Docker image builds on every PR, so that regressions are blocked before merge.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Runs Python 3.13 pytest, Node 22 oxlint/vite build, and docker build gates; exits non-zero on failure.
- **EVCP-21: Continuous Deployment (CD) Automation**
  - *User Story:* As a release engineer, I want automated rolling deployment using Docker Compose triggered on successful `main` builds with post-deployment health verification, so that releases occur seamlessly.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Pulls/builds latest images, starts containers with `docker compose up -d`, and validates `/health` HTTP 200.

### Epic 9: Observability & Monitoring
- **EVCP-22: Prometheus Metrics & Health Exposition**
  - *User Story:* As a site reliability engineer, I want FastAPI to expose HTTP telemetries and live SQLite business gauges at `/metrics`, so that system load and volunteer fill rates can be scraped continuously.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* `evcp_volunteers_total`, `evcp_volunteers_checked_in`, `evcp_coverage_gaps_total` exposed in Prometheus exposition format.
- **EVCP-23: Grafana Monitoring Visualization**
  - *User Story:* As an event director, I want Grafana provisioned with pre-configured Prometheus datasources, so that request rates, error spikes, and crowd staffing metrics can be visualized on interactive monitors.
  - *Story Points:* `5` | *Priority:* `High`
  - *Acceptance Criteria:* Grafana container accessible on port 3001 with Prometheus datasource configured and active.

---

## 5. Tasks and Subtasks Breakdown

Detailed technical breakdown for high-complexity stories:

```text
Story EVCP-9: 100-Point Rule-Based Soft Scoring & Scarcity Allocation
├── EVCP-9.1: Implement skill match heuristic (core 15 pts + secondary 15 pts)
├── EVCP-9.2: Implement zone and role preference alignment calculator (15 pts)
├── EVCP-9.3: Implement workload fairness formula [20 - 2.5 * current_hours] (20 pts)
├── EVCP-9.4: Implement zone criticality & staffing deficit booster (25 pts)
├── EVCP-9.5: Implement historical reliability scoring [10 - 3*no_shows - 1.5*dropouts] (10 pts)
└── EVCP-9.6: Write unit tests verifying deterministic scoring output (test_enhancements.py)

Story EVCP-20: Automated CI Pipeline (GitHub Actions)
├── EVCP-20.1: Create .github/workflows/ci.yml with push and pull_request triggers
├── EVCP-20.2: Configure Python 3.13 runner step with dependency caching and pytest -v
├── EVCP-20.3: Configure Node.js 22 runner step with npm ci, oxlint, and vite build
├── EVCP-20.4: Add Docker build verification job dependent on test/lint jobs
└── EVCP-20.5: Verify pipeline pass rate on GitHub Actions runner

Story EVCP-21: Continuous Deployment (CD) Automation
├── EVCP-21.1: Extend ci.yml with deploy job gated on needs: [docker-build] and refs/heads/main
├── EVCP-21.2: Add docker compose config static syntax validation step
├── EVCP-21.3: Execute docker compose build and up -d container recreation
├── EVCP-21.4: Implement polling health check loop targeting /health and /nginx-health
└── EVCP-21.5: Document deployment recovery policy in docs/experiment-5-cd.md
```

---

## 6. Bugs Tracked in Backlog

| Issue Key | Bug Title | Severity / Priority | Root Cause & Resolution Description | State |
|---|---|:---:|---|:---:|
| **EVCP-B1** | Stale `assignment_status` after dropout re-assignment | High | Reassigning a volunteer after dropout left status as `DROPPED_OUT`, causing coverage to report 0 headcount. Resolved by resetting status to `ASSIGNED`. | `Done` |
| **EVCP-B2** | Docker SQLite volume permission crash (`OperationalError`) | Highest | Named volume `evcp_db_data` mounted with `root:root` ownership, blocking non-root `appuser`. Resolved via `entrypoint.sh` privilege step-down using `gosu`. | `Done` |
| **EVCP-B3** | Windows CP1252 Unicode encoding crash on CLI tests | Medium | Printing checkmark characters (`✓`) threw `UnicodeEncodeError` on Windows consoles. Resolved by standardizing UTF-8 stdout reconfiguration. | `Done` |
| **EVCP-B4** | Out-of-process HTTP test runner in CI environment | High | `test_assignment.py` originally assumed live server on `http://127.0.0.1:8001`. Resolved by refactoring to in-process FastAPI `TestClient(app)`. | `Done` |

---

## 7. 4-Sprint Release Roadmap

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SPRINT 1: Core Foundation & Entity Models (2 Weeks, 23 Story Points)                            │
│ Goal: Set up developer workspace, database schema, entity models, and container foundations.    │
│ Stories: EVCP-1, EVCP-2, EVCP-3, EVCP-4, EVCP-6, EVCP-18                                        │
│ Status: COMPLETED                                                                               │
└────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SPRINT 2: Intelligent Volunteer Assignment Engine (2 Weeks, 31 Story Points)                    │
│ Goal: Deliver the 2-stage matching engine, availability slots, conflict checks, and rebalancing.│
│ Stories: EVCP-5, EVCP-7, EVCP-8, EVCP-9, EVCP-10, EVCP-B1                                       │
│ Status: COMPLETED                                                                               │
└────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SPRINT 3: Field Operations, Attendance & Escalations (2 Weeks, 31 Story Points)                 │
│ Goal: Implement live check-in/out, no-show detection, 4-tier SLA escalation, and task boards.    │
│ Stories: EVCP-11, EVCP-12, EVCP-13, EVCP-14, EVCP-15, EVCP-16, EVCP-17                          │
│ Status: COMPLETED                                                                               │
└────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SPRINT 4: DevOps Automation & Observability Stack (2 Weeks, 28 Story Points)                    │
│ Goal: Full CI/CD pipelines, Docker Compose multi-service deployment, and Prometheus monitoring. │
│ Stories: EVCP-19, EVCP-20, EVCP-21, EVCP-22, EVCP-23, EVCP-B2, EVCP-B4                          │
│ Status: COMPLETED                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Scrum & Kanban Board Execution

### Scrum Board Workflow
Work transitions strictly through 4 columns:
1. **TO DO:** Backlog items selected and committed for the active sprint.
2. **IN PROGRESS:** Actively being developed in a dedicated feature branch (`feature/*`).
3. **TESTING:** Pull request open; local unit/integration tests and CI checks executing.
4. **DONE:** Code reviewed, merged to `main`, deployed, and acceptance criteria fulfilled.

### Current Board Snapshot
```text
┌─────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
│     TO DO       │     IN PROGRESS      │       TESTING        │         DONE         │
├─────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ (Sprint Backlog │                      │                      │ EVCP-1 to EVCP-23    │
│  exhausted; all │                      │                      │ EVCP-B1 to EVCP-B4   │
│  planned items  │                      │                      │ (All 113 Story Pts   │
│  delivered)     │                      │                      │  successfully Done)  │
└─────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘
```

### Kanban Mode
For continuous operational maintenance post-Sprint 4, the board functions as a **WIP-limited Kanban board**:
- **WIP Limits:** `In Progress` = Max 3 issues; `Testing` = Max 2 issues.
- **Continuous Flow:** Incoming emergency bugs or SLA enhancement tickets pull directly through the workflow without fixed sprint batching.

---

## 9. Story Point & Velocity Analysis

- **Estimation System:** Modified Fibonacci sequence (`1, 2, 3, 5, 8, 13`).
  - `1 - 2 pts`: Minor UI adjustments, label fixes, single endpoint query.
  - `3 pts`: Basic CRUD service, component scaffolding, unit test suites.
  - `5 pts`: Complex UI views, database migration with schema sync, CI/CD pipeline stage.
  - `8 pts`: Algorithmic engines (Two-stage assignment, 4-tier SLA escalation background loop).
- **Sprint Velocity Summary:**
  - **Sprint 1 Velocity:** `23 Story Points` (100% committed delivered)
  - **Sprint 2 Velocity:** `31 Story Points` (100% committed delivered)
  - **Sprint 3 Velocity:** `31 Story Points` (100% committed delivered)
  - **Sprint 4 Velocity:** `28 Story Points` (100% committed delivered)
  - **Average Team Velocity:** `28.25 Story Points / Sprint`

---

## 10. Agile Reporting Artifacts

When viewed inside the Jira web workspace, the following standard reports illustrate project health:

1. **Sprint Burndown Chart:**  
   Displays remaining story points day-by-day. Because stories were decomposed into granular tasks with daily commits, the actual burndown line tracks closely along the guideline downward slope without steep "waterfall" drops at sprint close.
2. **Velocity Chart:**  
   Shows committed vs. completed story points across Sprints 1 to 4. Demonstrates consistent predictability with zero scope spillover across sprints.
3. **Cumulative Flow Diagram (CFD):**  
   Visualizes the cumulative count of issues in each state over time. Bands for `Done` expand steadily while `In Progress` remains narrow and consistent, proving that Work-in-Progress (WIP) was tightly constrained.
4. **Sprint Report:**  
   Provides sprint completion retrospectives, detailing completed issues, story points, and bug resolution histories.

---

## 11. Verification Matrix

| Agile Dimension | Scope / Deliverable | Status | Evidence |
|---|---|:---:|---|
| **Project Schema** | Jira Scrum & Kanban configuration | **VERIFIED** | Formally structured with `EVCP` key and 4-tier workflow |
| **Epics Breakdown** | 9 Domain Epics (EVCP-E1 to EVCP-E9) | **VERIFIED** | 100% mapped to existing codebase modules |
| **User Stories** | 23 User Stories with Story Points | **VERIFIED** | Complete acceptance criteria and Fibonacci estimates |
| **Task Decomposition**| Technical subtasks for complex stories | **VERIFIED** | Assignment Engine & CI/CD subtasks defined |
| **Defect Tracking** | 4 documented real-world bugs (EVCP-B1..B4) | **VERIFIED** | Root causes and solutions recorded |
| **Sprint Structure**| 4 distinct 2-week Sprints | **VERIFIED** | Total 113 Story Points distributed with clear goals |
| **Documentation** | `docs/experiment-6-jira.md` | **VERIFIED** | Complete markdown reference in repository |
