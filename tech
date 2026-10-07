# Event Volunteer & Crowd Coordination Platform - Technology Stack & Web App Summary

---

## 1. Executive Summary of the Web Application

The **Event Volunteer & Crowd Coordination Platform** is a specialized, production-ready coordination system designed for organizing, deploying, and managing volunteer workforces during large-scale events (such as technology summits, music festivals, marathons, and academic conventions).

Unlike generic event discovery websites or static spreadsheet tools, the platform bridges the real-time gap between **event organizers/coordinators** and **field volunteers**. It features a mathematical, rule-based 2-stage volunteer matching engine, automated no-show detection, live attendance tracking with hour calculation, Kanban task management, and an SLA-driven emergency incident escalation system.

### Core Value Proposition
- **Automated Talent Matching:** Replaces manual shift assignment with a multi-factor constraint engine that balances skill requirements, availability, preferences, and workload fairness.
- **Dynamic Contingency Handling:** Handles last-minute volunteer dropouts with ranked replacement candidate recommendations and cross-zone staff rebalancing.
- **Real-Time Operational Visibility:** Provides coordinators with live metrics on coverage gaps, volunteer attendance, active tasks, and urgent crowd safety issues.
- **No Hardcoded Data:** All events, shifts, volunteers, assignments, tasks, and incidents are dynamically managed, validated, and stored in the database.

---

## 2. Dual-Persona Architecture & User Flows

The application is structured into two dedicated workflows:

### A. Volunteer Portal
1. **Self-Serve Registration:** Predefined skill selection, explicit day/time availability slot declaration, emergency contact, and preferred zones/roles.
2. **Personal Dashboard:** Immediate visibility into upcoming shifts, current active assignment, and event announcements.
3. **Session Hours & Attendance:** Single-click check-in and check-out with automatic duration computation and attendance history.
4. **My Tasks:** Real-time visibility of tasks dispatched by coordinators, with status progression (`OPEN` → `IN_PROGRESS` → `RESOLVED`).
5. **Incident Reporting:** Rapid reporting of field problems (Medical, Crowd Surge, Missing Equipment, Security) directly into the Incident Center.

### B. Coordinator Command Center
1. **Live Dashboard:** Unified view of total vs. checked-in volunteers, shift coverage percentage, critical staffing gaps, unresolved tasks, and open incidents.
2. **Shift Management & Auto-Assignment:** 1-click intelligent auto-assignment across all shifts or specific zones using the rule-based optimization engine.
3. **Dropout & Replacement Center:** Rapid handling of volunteer dropouts, automatic recalculation of coverage gaps, and scored replacement suggestions.
4. **Staff Rebalancing:** Detection of overstaffed vs. understaffed zones with one-click rebalance suggestions.
5. **Live Task Board:** Create, prioritize, and dispatch operational tasks to field volunteers with zone filtering.
6. **Incident Escalation Center:** Automatic routing of incidents to specialized coordinators (First Aid, Security, Operations) and time-based SLA escalation up to the Event Director.
7. **Broadcast Announcements:** Targeted announcements filtered by audience (`EVERYONE`, `VOLUNTEERS`, `COORDINATORS`, or specific `ZONE`).

---

## 3. Technology Stack Breakdown

### Backend Architecture
- **Language:** **Python 3.13**
- **Framework:** **FastAPI**
  - High-performance, asynchronous REST API.
  - Automatic OpenAPI / Swagger interactive documentation (`/docs`).
  - Native dependency injection and clean lifecycle handlers (`@asynccontextmanager`).
- **Server:** **Uvicorn (ASGI)**
  - Asynchronous, lightweight, event-driven web server.
- **ORM & Database:**
  - **SQLAlchemy 2.0:** Object-Relational Mapping with declarative models and relationships.
  - **SQLite (`event_platform.db`):** Relational storage with automatic schema reflection and safe backward-compatible data migrations.
- **Data Validation & Serialization:**
  - **Pydantic v2:** Strict request/response schemas, type safety, and input sanitization.
- **Periodic Background Engine:**
  - Asynchronous background runner running alongside FastAPI lifespan to handle automated 10-second checks for incident SLA escalation and shift no-show detection.

### Frontend Architecture
- **Core Framework:** **React 18 / 19**
  - Modern functional components with custom hooks (`useState`, `useEffect`, `useCallback`, `useMemo`).
  - Screen-state navigation with browser session persistence (`localStorage`).
- **Build Tooling:** **Vite v8.3.1**
  - Lightning-fast Hot Module Replacement (HMR).
  - Optimized production bundling (`npm run build` generates clean minified bundles in under 1 second).
- **Styling & UI System:** **Vanilla CSS (Design Tokens)**
  - Curated dark-mode aesthetic with modern typography (Inter/system sans).
  - Glassmorphic translucent cards, custom gradients, and responsive CSS Grid/Flexbox layouts.
  - Accessible badge indicators for shift coverage (`FULL`, `PARTIAL`, `CRITICAL`), priorities, and statuses.
- **Icons:** **Lucide React**
  - Consistent, lightweight SVG iconography across all action buttons and status cards.

---

## 4. Intelligent Algorithmic Engines

### 1. Two-Stage Volunteer Matching Engine (`assignment_engine.py`)
- **Stage 1: Hard Constraints (Pass/Fail Gatekeeper):**
  - *Declared Availability:* Shift times must fit within the volunteer's declared availability slots.
  - *Conflict Prevention:* Prevents overlapping shift assignments on the same day.
  - *Mandatory Skills:* Strict enforcement of required qualifications (e.g., CPR / Paramedic for medical shifts).
  - *Daily Workload Cap:* Limits volunteers to a maximum of 8.0 scheduled hours per calendar day.
  - *30-Minute Rest Rule:* Enforces a mandatory 30-minute buffer between consecutive shifts.
  - *Dropout Immunity:* Volunteers who drop out of a shift are excluded from auto-reassignment to that same shift.
- **Stage 2: 100-Point Rule-Based Soft Scoring:**
  - **Skill Match (up to 30 pts):** 15 pts for core/mandatory skill + up to 15 pts for optional/secondary skills.
  - **Preference Alignment (up to 15 pts):** Zone and role preference match.
  - **Workload Fairness (up to 20 pts):** Prioritizes volunteers with fewer assigned hours to avoid burnout (`20 - 2.5 * current_hours`).
  - **Zone Priority (up to 25 pts):** Prioritizes critical zones (Medical, Security) and understaffed shifts.
  - **Historical Reliability (up to 10 pts):** Dynamic score based on completed shifts vs. no-shows and dropouts (`10.0 - 3.0 * no_shows - 1.5 * dropouts`).

### 2. Scarcity-First Global Allocation Heuristic
- Shifts are globally ordered by **talent scarcity slack** (`eligible volunteers - required capacity`).
- Shifts requiring rare skills or higher capacity are staffed first, preventing general support shifts from starving critical safety roles.

### 3. Automated Incident Routing & SLA Escalation
- Incidents are automatically routed by type (e.g., `MEDICAL` → First Aid Coordinator, `CROWD_SURGE` → Security Coordinator).
- Unacknowledged critical incidents escalate through a 4-tier chain:
  - **Level 0:** Assigned Zone Coordinator
  - **Level 1:** Sector Supervisor (after SLA expiry)
  - **Level 2:** Head of Operations
  - **Level 3:** Event Director (capped at Level 3)
- Explicit coordinator acknowledgement halts further automated escalation.

### 4. No-Show Detection Engine
- Operates on active shifts with an injectable time provider for deterministic testing.
- Features a strict **15-minute grace period** past shift start time before flagging a volunteer as a no-show.
- Immunizes past/completed shifts from retroactive no-show triggers.

---

## 5. Verification & Testing Infrastructure

The platform includes automated end-to-end and unit test suites:
- **`test_e2e_final.py`:** Comprehensive 27-step live demonstration covering the full operational cycle (seeding, auto-assign, dropouts, replacement, rebalance, tasks, incidents, SLA escalation, attendance, and dashboard sync).
- **`test_enhancements.py`:** 10 core algorithm and safety rule unit tests.
- **`test_attendance.py`:** Check-in/check-out validation, duplicate check-in blocking, and session hour calculation.
- **`test_tasks.py`:** Live task board lifecycle, transition guards, and input validation.
- **`test_phase5.py` / `test_phase6.py`:** Incident escalation, announcements, dropouts, and rebalancing suites.
