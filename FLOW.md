# Platform Flow — Event Volunteer & Crowd Coordination

> **Hackathon MVP** - FastAPI + SQLite backend - React + Vite frontend
> No real authentication — demo session via localStorage

---

## Table of Contents

1. High-Level Architecture
2. Entry Flow — Role Selection
3. Volunteer Flow
4. Coordinator Flow
5. Session System
6. Route / Screen Protection
7. Frontend File Map
8. Backend API Map
9. Data Flow Diagrams
10. Refresh & Persistence
11. Switch Role / Logout

---

## 1. High-Level Architecture

```
BROWSER (React + Vite)

  localStorage --> session.js --> App.jsx (screen router)
                                       |
              +--------------------------+
              |                          |
        Volunteer side            Coordinator side
    +-------------------+     +------------------------+
    | LandingPage        |     | LandingPage             |
    | VolunteerReg.      |     | CoordinatorAccess       |
    | VolunteerDashboard |     | Navbar + Dashboard      |
    |   - My Tasks       |     |   - EventSetup          |
    |   - My Shifts      |     |   - ShiftAssignment     |
    |   - Announcements  |     |   - VolunteerRoster     |
    +-------------------+     |   - TaskBoard           |
                              |   - IncidentCenter      |
                              +------------------------+

                 HTTP (Axios, port 8001)
                          |
                          v

FastAPI Backend (uvicorn :8001)

  /api/volunteers    /api/tasks      /api/shifts
  /api/events        /api/issues     /api/announcements
  /api/assignments   /api/dashboard/metrics   /api/seed

  SQLite DB --> SQLAlchemy ORM --> Pydantic Schemas
```

---

## 2. Entry Flow — Role Selection

When the app first loads, App.jsx reads localStorage via resolveInitialScreen():

```
App loads
    |
    v
resolveInitialScreen()
    |
    +-- currentRole === "coordinator"              --> screen: coordinator-dash
    +-- currentRole === "volunteer"
    |     AND currentVolunteerId exists            --> screen: volunteer-dash
    +-- (nothing / cleared)                       --> screen: landing
```

### Landing Page (LandingPage.jsx)

Shown when no session exists. Presents two large role cards:

```
+------------------------------+   +------------------------------+
|   I'M A VOLUNTEER            |   |   I'M A COORDINATOR          |
|   Register and manage shifts |   |   Manage volunteers & events |
+------------------------------+   +------------------------------+
        |                                       |
        v                                       v
  Check existing session?             screen: coordinator-access
        |
        +-- YES (role=volunteer, id exists) --> screen: volunteer-dash
        +-- NO                             --> screen: volunteer-register
```

---

## 3. Volunteer Flow

### Step 1 — Registration (VolunteerRegistration.jsx)

Triggered when no volunteer session exists.

```
VolunteerRegistration renders
    |
    |  User fills form:
    |    - Full Name  (required)
    |    - Email      (required)
    |    - Phone
    |    - Skills
    |    - Preferred Zone
    |    - Emergency Contact
    |    - Notes
    |
    |  onClick "Register & Continue"
    |
    v
POST /api/volunteers  { full_name, email, phone, skills, ... }
    |
    +-- 400 Bad Request (email already registered)
    |       --> Show inline error, stay on form
    |
    +-- 201 Created  { id: 42, full_name: "...", ... }
            |
            v
    setVolunteerSession(42)
        +-- localStorage.currentRole        = "volunteer"
        +-- localStorage.currentVolunteerId = "42"
            |
            v
    onRegistered(42) --> App sets screen: "volunteer-dash"
```

### Step 2 — Volunteer Dashboard (VolunteerDashboard.jsx)

Loads immediately after registration (or on refresh if session exists).

```
VolunteerDashboard mounts
    |
    +-- getCurrentVolunteerId() --> 42
    |
    v
Promise.all([
  GET /api/volunteers/42                    --> profile data
  GET /api/tasks?volunteer_id=42            --> tasks assigned to this volunteer
  GET /api/announcements?event_id=X         --> event-wide announcements
  GET /api/assignments?volunteer_id=42      --> shifts
])
    |
    v
Renders 4 tabs:

  +--------------------------------------------------------------+
  |  My Dashboard  |  My Tasks  |  My Shifts  |  Announcements  |
  +--------------------------------------------------------------+

  "My Dashboard" tab:
    - Welcome banner with name + status badge
    - Stats row: total tasks, open, done, hours worked
    - Full profile card (skills, phone, zone, notes)
    - Quick-link buttons to other tabs

  "My Tasks" tab:
    - Lists only tasks where assigned_volunteer_id = currentVolunteerId
    - Shows title, status pill (OPEN / IN_PROGRESS / DONE / BLOCKED)
    - Shows priority (LOW / MEDIUM / HIGH / CRITICAL) and zone

  "My Shifts" tab:
    - Lists shift assignments for this volunteer
    - Shows shift name, time window, zone

  "Announcements" tab:
    - Lists all announcements for the selected event
    - Coordinator-posted messages visible to volunteers
```

---

## 4. Coordinator Flow

### Step 1 — Access Page (CoordinatorAccess.jsx)

```
CoordinatorAccess renders
    |
    |  Shows:
    |    "Coordinator Access"
    |    "Continue to the event coordination dashboard."
    |    [ Continue as Coordinator ]  <- amber button
    |    [ <- Back to role selection ]
    |
    |  onClick "Continue as Coordinator"
    |
    v
setCoordinatorSession()
    +-- localStorage.currentRole = "coordinator"
    +-- localStorage.currentVolunteerId --> REMOVED
        |
        v
App sets screen: "coordinator-dash"
```

### Step 2 — Coordinator Dashboard (full existing app)

The original application renders intact, with an added Switch Role button in Navbar.jsx.

```
Coordinator Dashboard loads
    |
    v
loadInitialData()
    +-- GET /api/events                         --> event list (dropdown)
    +-- GET /api/dashboard/metrics?event_id=X   --> KPI cards
    +-- GET /api/volunteers                     --> volunteer list

Auto-refreshes every 10 seconds.

Tabs available to coordinator:
  +---------------------------------------------------------------+
  |  Dashboard  |  Event & Roles  |  Shift Matching  | Volunteers |
  |  Task Board |  Comms & Alerts                                 |
  +---------------------------------------------------------------+

  "Dashboard":
    - Live KPI cards (check-in rate, task completion, shift fill %)
    - Active incidents summary
    - Quick action buttons

  "Event & Roles" (EventSetup.jsx):
    - Create events, add role quotas per event

  "Shift Matching" (ShiftAssignment.jsx):
    - View/create shifts per event
    - Auto-assign volunteers by availability + skills
    - Manual assign / unassign
    - Dropout handling + rebalancing

  "Volunteers & Check-In" (VolunteerRoster.jsx):
    - Full volunteer list with search + status filter
    - Manual check-in / check-out
    - View attendance history
    - Manage availability slots
    - Register new volunteers (coordinator-initiated)

  "Task Board" (TaskBoard.jsx):
    - Kanban-style task management
    - Filter by zone
    - Assign tasks to any volunteer
    - Create / delete tasks

  "Comms & Alerts" (IncidentCenter.jsx):
    - Create / manage incidents and escalations
    - Post announcements visible to all volunteers
    - View escalated issues
```

---

## 5. Session System

All session logic lives in src/services/session.js — never duplicated across components.

```javascript
// Keys used in localStorage
localStorage.currentRole          // "volunteer" | "coordinator"
localStorage.currentVolunteerId   // numeric string e.g. "42"

// Functions exported from session.js
getCurrentRole()           --> string | null
getCurrentVolunteerId()    --> number | null
setVolunteerSession(id)    --> sets both keys
setCoordinatorSession()    --> sets role, removes volunteer ID
clearSession()             --> removes both keys
```

### Who calls what

| Caller                      | Function                  | When                                        |
|-----------------------------|---------------------------|---------------------------------------------|
| App.jsx                     | getCurrentRole()          | On first load to decide initial screen      |
| App.jsx                     | getCurrentVolunteerId()   | On first load to check volunteer session    |
| App.jsx                     | setCoordinatorSession()   | After coordinator clicks "Continue"         |
| App.jsx                     | clearSession()            | On Switch Role (coordinator side)           |
| VolunteerRegistration.jsx   | setVolunteerSession(id)   | After successful API registration           |
| VolunteerDashboard.jsx      | getCurrentVolunteerId()   | To fetch volunteer-specific data            |
| VolunteerDashboard.jsx      | clearSession()            | On Switch Role (volunteer side)             |

---

## 6. Route / Screen Protection

App.jsx uses a screen state variable — no URL router needed.
Everything is a single-page state machine.

| screen value          | Renders                    | Requires                                  |
|-----------------------|----------------------------|-------------------------------------------|
| "landing"             | LandingPage                | —                                         |
| "coordinator-access"  | CoordinatorAccess          | —                                         |
| "volunteer-register"  | VolunteerRegistration      | —                                         |
| "volunteer-dash"      | VolunteerDashboard         | currentRole=volunteer + currentVolunteerId |
| "coordinator-dash"    | Full coordinator app       | currentRole=coordinator                   |

If localStorage is in an invalid state, resolveInitialScreen() falls back to "landing".

---

## 7. Frontend File Map

```
frontend/src/
|
+-- App.jsx                          <- Main screen router + coordinator app shell
|
+-- services/
|   +-- api.js                       <- All Axios API calls
|   +-- session.js                   <- localStorage session helper      [NEW]
|
+-- components/
    |
    +-- ROLE ENTRY FLOW (new files)
    +-- LandingPage.jsx              <- Role selection screen             [NEW]
    +-- CoordinatorAccess.jsx        <- Coordinator confirmation          [NEW]
    +-- VolunteerRegistration.jsx    <- Volunteer self-registration       [NEW]
    +-- VolunteerDashboard.jsx       <- Volunteer's personal portal       [NEW]
    |
    +-- COORDINATOR APP (existing, unchanged)
    +-- Navbar.jsx                   <- Top nav + Switch Role button      [UPDATED]
    +-- Dashboard.jsx                <- KPI overview cards
    +-- EventSetup.jsx               <- Event + role quota creation
    +-- ShiftAssignment.jsx          <- Shift matching & auto-assign
    +-- VolunteerRoster.jsx          <- Volunteer list, check-in/out
    +-- TaskBoard.jsx                <- Task CRUD + assignment
    +-- IncidentCenter.jsx           <- Incidents, alerts, comms
```

---

## 8. Backend API Map

The backend is UNCHANGED. All existing endpoints are reused.

```
Method   Endpoint                                Used by
------------------------------------------------------------------------
GET      /api/events                             Coordinator dashboard
POST     /api/events                             EventSetup
GET      /api/events/:id/roles                   EventSetup
POST     /api/roles                              EventSetup

GET      /api/volunteers                         Coordinator roster, task board
POST     /api/volunteers                         VolunteerRegistration  <- KEY
GET      /api/volunteers/:id                     VolunteerDashboard (profile)
PUT      /api/volunteers/:id                     VolunteerRoster (edit)
POST     /api/volunteers/:id/check-in            VolunteerRoster
POST     /api/volunteers/:id/check-out           VolunteerRoster
GET      /api/volunteers/:id/availability        VolunteerRoster
POST     /api/volunteers/:id/availability        VolunteerRoster

GET      /api/events/:id/shifts                  ShiftAssignment
POST     /api/shifts                             ShiftAssignment
POST     /api/shifts/assign                      ShiftAssignment
DELETE   /api/shifts/assignments/:id             ShiftAssignment
POST     /api/assignments/auto-assign            ShiftAssignment
POST     /api/assignments/dropout                ShiftAssignment
POST     /api/assignments/rebalance              ShiftAssignment
GET      /api/assignments                        VolunteerDashboard (shifts tab)

GET      /api/tasks                              TaskBoard + VolunteerDashboard
  └── ?volunteer_id=42                          <- filters to that volunteer only
  └── ?event_id=1                               <- filters to event
POST     /api/tasks                              TaskBoard
PUT      /api/tasks/:id                          TaskBoard
DELETE   /api/tasks/:id                          TaskBoard

GET      /api/issues                             IncidentCenter
POST     /api/issues                             IncidentCenter
PUT      /api/issues/:id                         IncidentCenter
POST     /api/issues/:id/acknowledge             IncidentCenter
POST     /api/issues/:id/resolve                 IncidentCenter

GET      /api/announcements                      VolunteerDashboard
  └── ?event_id=1                               <- event-scoped
POST     /api/announcements                      IncidentCenter

GET      /api/dashboard/metrics?event_id=1       Dashboard KPI cards
POST     /api/seed                               Reset demo data
```

### Registration response (key to the volunteer session)

```json
POST /api/volunteers
--> 201 Created
{
  "id": 42,
  "full_name": "Jane Doe",
  "email": "jane@demo.com",
  "status": "Registered",
  "skills": "First Aid",
  "preferences": "North Gate"
}
```

The returned id is stored as localStorage.currentVolunteerId.

---

## 9. Data Flow Diagrams

### Volunteer Registration to Dashboard

```
User fills form
    |
    v
VolunteerRegistration.jsx
    |  volunteerService.createVolunteer(formData)
    v
POST /api/volunteers --> crud.create_volunteer(db, data)
                              |
                              v
                    INSERT INTO volunteers...
                    RETURN { id: 42, ... }
    |
    v
res.data.id = 42
    |
    +-- setVolunteerSession(42)
    |       +-- localStorage.currentRole        = "volunteer"
    |       +-- localStorage.currentVolunteerId = "42"
    |
    +-- onRegistered(42) --> App: setScreen("volunteer-dash")
            |
            v
    VolunteerDashboard mounts
            |
            +-- GET /api/volunteers/42
            +-- GET /api/tasks?volunteer_id=42
            +-- GET /api/announcements?event_id=X
            +-- GET /api/assignments?volunteer_id=42
```

### Coordinator Entry

```
Landing --> click "I'M A COORDINATOR"
    |
    v
CoordinatorAccess.jsx
    |  click "Continue as Coordinator"
    v
setCoordinatorSession()
    +-- localStorage.currentRole = "coordinator"
    +-- localStorage.currentVolunteerId --> removed
    |
    v
App: setScreen("coordinator-dash")
    |
    v
Full coordinator app renders
    |
    v
loadInitialData()
    +-- GET /api/events
    +-- GET /api/dashboard/metrics?event_id=X
    +-- GET /api/volunteers
    |
    +-- setInterval(loadInitialData, 10000)   <- auto-refresh every 10s
```

---

## 10. Refresh & Persistence

The session survives browser refresh because localStorage persists.

```
Volunteer registers --> currentRole="volunteer", currentVolunteerId="42"
Browser refreshes
    |
    v
App.jsx loads --> resolveInitialScreen()
    |
    +-- getCurrentRole()        --> "volunteer"
    +-- getCurrentVolunteerId() --> 42
    |
    v
screen = "volunteer-dash"   (skips landing and registration)

--------------------------------------------------------------------

Coordinator sets role --> currentRole="coordinator"
Browser refreshes
    |
    v
resolveInitialScreen() --> screen = "coordinator-dash"
```

Only clearSession() (Switch Role / Logout) resets back to landing.

---

## 11. Switch Role / Logout

Available in both volunteer and coordinator views.

### Volunteer side

VolunteerDashboard.jsx — top-right header button:

```
[Switch Role] --> clearSession() --> onSwitchRole() --> App: setScreen("landing")
```

### Coordinator side

Navbar.jsx — top-right (rendered only when onSwitchRole prop is passed):

```
[Switch Role] --> clearSession() --> onSwitchRole() --> App: setScreen("landing")
```

### What clearSession() does

```javascript
localStorage.removeItem("currentRole")
localStorage.removeItem("currentVolunteerId")
```

After this, resolveInitialScreen() returns "landing" on the next render.

---

## Quick Reference

| Action                             | Result                                     |
|------------------------------------|--------------------------------------------|
| Fresh load (no session)            | Landing page                               |
| Click Volunteer (no session)       | Registration form                          |
| Submit registration                | Volunteer Dashboard                        |
| Refresh browser (as volunteer)     | Volunteer Dashboard (session persists)     |
| Click Coordinator                  | Coordinator Access page                    |
| Click Continue as Coordinator      | Coordinator Dashboard                      |
| Refresh browser (as coordinator)   | Coordinator Dashboard (session persists)   |
| Click Switch Role (either side)    | Clears session -> Landing page             |
| Reload with tampered localStorage  | Falls back to Landing page                 |

---

Generated: 2026-10-01 - CrowdCoord Hackathon MVP
