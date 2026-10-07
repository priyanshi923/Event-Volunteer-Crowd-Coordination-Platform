# Event Volunteer & Crowd Coordination Platform
## Complete Features & Capabilities Catalog

The **Event Volunteer & Crowd Coordination Platform** is a real-time situational awareness, algorithmic workforce deployment, and crowd incident response system built for festivals, conventions, sports arenas, and large-scale public gatherings.

---

## 🏛️ System Architecture

- **Backend**: Python 3.13, FastAPI, SQLite, SQLAlchemy ORM, Pydantic v2
- **Frontend**: React 18, Vite, Tailwind CSS, Axios, Lucide React icons
- **Resilience**: 
  - Dual-port automatic network fallback (`8001` ↔ `8000`).
  - Optimistic UI updates with instant server synchronization.
  - Zero-dependency rule-based scoring (no black-box AI APIs or external network latency).

---

## 📋 Comprehensive Feature Breakdown

### 1. Event & Role Management (`EventSetup.jsx`)
- **Event Lifecycle Setup**:
  - Create and manage multi-day events with venue locations, operational windows, and status indicators.
  - Event switcher in the navigation bar dynamically scoped across all platform modules.
- **Role Quota Definition**:
  - Define operational roles (e.g. *Crowd Safety Marshal*, *First Aid Responder*, *VIP Escort*, *Registration Coordinator*, *Logistics Lead*).
  - Configure required specialized skills (e.g., *Crowd Control*, *First Aid / CPR*, *VIP Handling*, *Customer Service*, *Logistics*).
  - Set headcount target quotas per role with real-time filled vs needed progress.

---

### 2. Volunteer Profiles & Gate Attendance (`VolunteerRoster.jsx`)
- **Comprehensive Volunteer Dossiers**:
  - Volunteer records storing full name, email, phone number, certified skills, assigned venue zone preferences, and notes.
  - In Case of Emergency (ICE) emergency contact records.
- **Real-Time Gate Check-In & Check-Out**:
  - One-click **Check-In** recording ISO-8601 arrival timestamps.
  - One-click **Check-Out** with automated session duration calculation and cumulative volunteer hours accumulation.
  - Status indicators: `Registered`, `Checked In` (active on site), `Checked Out`.
- **Attendance History Log Modal**:
  - View individual volunteer attendance history with exact check-in/out session stamps and hours worked.
- **Search & Filtering**:
  - Debounced search filter by volunteer name, skill keywords, or check-in status.

---

### 3. 5-Weight Rule Engine for Shift Assignment (`ShiftAssignment.jsx`)
- **Zone-Mapped Operational Shifts**:
  - Schedule shifts by venue zone (*North Gate*, *Main Stage*, *Medical Tent*, *VIP Lounge*, *Registration*, *Food Court*).
  - Explicit start and end operational windows (e.g. `08:00 - 12:00`).
- **5-Weight Rule-Based Scoring Model (100 Points Total)**:
  1. **Skills Match (`40 pts`)**: Certified skill match to the shift's operational requirement (e.g. *Crowd Control*, *First Aid*).
  2. **Availability (`25 pts`)**: Volunteer is available and on site; penalizes dropped-out or checked-out personnel.
  3. **No Schedule Conflicts (`20 pts`)**: Automatic overlap detection preventing double-booking across concurrent timeframes.
  4. **Zone / Role Preference (`10 pts`)**: Matches volunteer's stated venue or role preferences.
  5. **Workload Fairness (`5 pts`)**: Prefers volunteers with lower cumulative assigned hours to balance fatigue.
- **Coverage & Staffing Metrics**:
  - Tracks `required_count`, `assigned_count`, `coverage_percentage`, and `coverage_gap`.
  - Color-coded status badges: `FULL` (≥100%), `PARTIAL` (1–99%), `CRITICAL` (0% staffed).
  - Visual capacity progress bar and real-time deficit warnings (e.g. *"⚠️ Deficit: Need 2 more volunteers"*).
- **Auto-Assignment Engine**:
  - **Single Shift Auto-Assign**: Immediately fills open slots on a shift with the top-scoring candidates.
  - **Global Event Auto-Assign**: Batch-assigns volunteers across all shifts, automatically prioritizing `CRITICAL` zero-staffed shifts first.
- **Transparent Recommendation Modal**:
  - Candidate cards showing match score (`/100`), 5-score breakdown pills, current workload hours, and human-readable score explanations.

---

### 4. Volunteer Dropout & Rapid Replacement (`ShiftAssignment.jsx`)
- **Automated Dropout Handling (`POST /assignments/dropout`)**:
  - One-click dropout trigger on assigned volunteer cards.
  - Marks the volunteer as `Dropped Out` and unavailable for that specific shift.
  - Cancels active assignment, decrements assigned headcount, and flags the coverage gap.
- **Dedicated Replacement Modal**:
  - Displays affected shift title, zone, timeframe, and dropout notice.
  - Displays recalculated coverage strip: `Required`, `Assigned`, `Coverage %`, and `Staffing Gap`.
  - Automatically queries the rule engine for replacement candidates.
  - Candidate cards present certified skills, availability status (`Available`, `Available (Checked In)`, `Busy (Conflict)`), workload hours, score breakdown pills, and recommendation explanation.
- **Immediate Gap Resolution**:
  - One-click **"Assign Replacement"** button assigns the selected candidate, restores shift coverage, eliminates the deficit, and updates the UI instantly.

---

### 5. Staffing Rebalancing & Zone Optimization (`ShiftAssignment.jsx`)
- **Cross-Zone Surplus Detection (`POST /assignments/rebalance`)**:
  - Analyzes staffing levels across all venue zones to find overstaffed shifts (`assigned > required`) and understaffed shifts (`assigned < required`).
  - Strict safety constraint: Source shifts can only donate staff if they remain adequately covered (`assigned - 1 >= required`).
- **Interactive Rebalancing Modal**:
  - Displays Understaffed Zones badges with deficit counts (e.g. `Main Stage (1 needed)`).
  - Displays Overstaffed / Surplus Zones badges (e.g. `North Gate (1 surplus)`).
  - Generates cross-zone transfer recommendations with visual **"From (Overstaffed) ➔ To (Deficit Gap)"** routing.
  - Calculates and displays expected coverage improvements (e.g. *"Increases Main Stage coverage from 50% to 100%, while North Gate remains adequately staffed at 100%"*).
- **Flexible Execution**:
  - **Individual Transfer**: Coordinator can review and click **"Accept & Move Volunteer"** for a specific candidate (`POST /assignments/rebalance/accept`).
  - **Batch Rebalance**: Coordinator can click **"Accept All Rebalance Suggestions"** to rebalance the entire event simultaneously.

---

### 6. Live Task Board Kanban (`TaskBoard.jsx`)
- **3-Column Ground Dispatch Kanban**:
  - `OPEN` ➔ `IN_PROGRESS` ➔ `RESOLVED`.
  - Real-time drag/click state progression with optimistic UI updates.
- **Card Metadata**:
  - Venue zone badge, priority indicator (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), description, creation timestamp, and assigned volunteer badge.
- **On-Card Volunteer Dispatch**:
  - Dropdown directly on each task card to assign or reassign available volunteers.
- **Zone Filtering**:
  - Quick filter to view tasks by specific venue zone or venue-wide.

---

### 7. Incident Center, Issue Management & Announcements (`IncidentCenter.jsx`)
- **Incident & Issue Lifecycle**:
  - Tracks issues through `OPEN` ➔ `ACKNOWLEDGED` ➔ `RESOLVED` with precise timestamping (`created_at`, `acknowledged_at`, `resolved_at`).
  - Supported issue types: `MEDICAL`, `CROWD_SURGE`, `MISSING_EQUIPMENT`, `SECURITY`, `OTHER`.
- **Automatic Coordinator Triage & Routing**:
  - `MEDICAL` ➔ **First Aid Coordinator**
  - `CROWD_SURGE` ➔ **Security Coordinator**
  - `SECURITY` ➔ **Security Coordinator**
  - `MISSING_EQUIPMENT` ➔ **Operations Coordinator**
  - `OTHER` ➔ **Event Coordinator**
- **Priority Escalation**:
  - Priorities: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` with visual alert styling and pulse animations for critical emergencies.
- **Targeted Broadcast Announcements**:
  - Broadcast operational announcements to:
    - `EVERYONE` (venue-wide broadcast)
    - Specific `ZONE` (e.g. *North Gate*, *Main Stage*)
    - Specific `ROLE` (e.g. *Crowd Safety Marshal*, *First Aid Responder*)
  - Configurable priority tags (`General`, `High`, `Critical Alert`) and author attribution.
- **Multi-Factor Filtering**:
  - Filter issues by status (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`), issue type, priority, and zone.

---

### 8. Coordination Dashboard (`Dashboard.jsx`)
- **High-Level Operational KPIs**:
  - **Volunteers**: Total registered, checked-in count, check-in percentage bar, available count, total volunteer hours.
  - **Shift Coverage**: Total shifts, fully staffed count, fill rate percentage bar, shifts needing staff.
  - **Live Tasks**: Total tasks, open count, in-progress count, resolved count, high/critical task warning.
  - **Crowd Alerts & Issues**: Open issues count, critical issues count, high priority alerts.
- **Staffing Rebalancing & Coverage Gaps Card**:
  - 4 Mini KPIs: `Coverage Gaps`, `Understaffed Shifts`, `Overstaffed Shifts`, `Rebalance Actions`.
  - Zone balance badges displaying understaffed and surplus zones.
  - Recommended cross-zone transfers preview with expected coverage improvement.
  - Shifts requiring volunteer replacements list with one-click navigation to Shift Matcher.
- **Urgent Issues Alert Banner**:
  - Prominently showcases high/critical open issues requiring immediate coordinator intervention.
- **Crowd Zone Safety & Deployment Radar**:
  - Venue zone grid monitoring active volunteers, active tasks, open incidents, and crowd flow status (`Normal`, `Attention Needed`, `Critical Surge`).
- **Demo Management**:
  - **"Reset Demo Data"** button with `force=true` parameter to instantly re-seed a clean demonstration dataset.

---

## 🔌 API Endpoint Directory

### Events & Roles
- `GET /api/events` — List all events.
- `GET /api/events/{id}` — Get event details.
- `POST /api/events` — Create a new event.
- `GET /api/events/{id}/roles` — List roles and quotas for an event.
- `POST /api/roles` — Create a role quota.

### Volunteers & Attendance
- `GET /api/volunteers` — List volunteers (supports `?search=` and `?status=`).
- `GET /api/volunteers/{id}` — Get volunteer dossier with attendance history.
- `POST /api/volunteers` — Register a new volunteer.
- `POST /api/volunteers/{id}/check-in` — Check in volunteer and record arrival timestamp.
- `POST /api/volunteers/{id}/check-out` — Check out volunteer, compute session hours, and update totals.

### Shifts, Assignments & Rule Scoring
- `GET /api/events/{id}/shifts` — List shifts with real-time coverage calculations.
- `POST /api/shifts` — Schedule a new shift.
- `POST /assignments/assign` (`/shifts/assign`) — Assign volunteer to shift.
- `DELETE /shifts/assignments/{id}` — Unassign volunteer.
- `GET /shifts/{id}/suggestions` — Get top 3 eligible volunteers scored by 5-weight rule engine.
- `GET /api/shifts/{id}/recommendations` — Full scored recommendation list with breakdowns.
- `POST /assignments/auto-assign` — Auto-assign single shift or entire event.
- `GET /assignments` — List active assignments.

### Dropout & Staffing Rebalancing
- `POST /assignments/dropout` — Mark volunteer dropped out, recalculate coverage, return replacements.
- `POST /assignments/rebalance` — Analyze venue staffing and generate cross-zone transfer plan.
- `POST /assignments/rebalance/accept` — Apply an individual transfer recommendation.

### Live Tasks (Kanban)
- `GET /api/tasks` — List tasks (supports `?event_id=` and `?zone=`).
- `POST /api/tasks` — Create a ground dispatch task.
- `PUT /api/tasks/{id}` — Update task status (`OPEN`, `IN_PROGRESS`, `RESOLVED`) or assigned volunteer.
- `DELETE /api/tasks/{id}` — Delete a task.

### Incidents, Issues & Announcements
- `GET /api/issues` — List issues (supports `?status=`, `?issue_type=`, `?zone=`, `?priority=`).
- `POST /api/issues` — Report an issue with automatic coordinator routing.
- `GET /api/issues/{id}` — Get single issue details.
- `POST /api/issues/{id}/acknowledge` — Acknowledge issue with timestamp.
- `POST /api/issues/{id}/resolve` — Resolve issue with timestamp.
- `GET /api/announcements` — Retrieve broadcast announcements feed.
- `POST /api/announcements` — Broadcast announcement (`EVERYONE`, `ZONE`, `ROLE`).

### Dashboard & Utilities
- `GET /api/dashboard/metrics` — Aggregate venue KPIs, zone summaries, coverage gaps, and rebalance suggestions.
- `POST /api/seed` (`/seed`) — Seed or force-reset the demo dataset (`?force=true`).

---

## 🧪 Verification & Automated Test Suites

The platform includes 5 automated test suites:

1. **`test_e2e_final.py`** — Verifies the complete 27-step end-to-end demo workflow (Dashboard ➔ Auto-Assign ➔ Dropout ➔ Replacement ➔ Rebalance ➔ Task Board ➔ Incident Routing ➔ Acknowledgement/Resolution ➔ Announcements ➔ Check-in/Out ➔ Dashboard verification).
2. **`test_phase6.py`** — Comprehensive tests for volunteer dropout, gap calculation, 5-weight replacement scoring, and cross-zone staff rebalancing.
3. **`test_phase5.py`** — Comprehensive tests for issue triage, coordinator auto-routing, acknowledgement, resolution, and targeted announcements.
4. **`test_tasks.py`** — Comprehensive tests for Kanban columns, status transitions, priority handling, and task assignment.
5. **`test_attendance.py`** — Comprehensive tests for gate check-in, check-out, duration calculation, and volunteer profile metrics.
