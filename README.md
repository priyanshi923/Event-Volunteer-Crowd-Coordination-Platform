# Event Volunteer & Crowd Coordination Platform (Hackathon MVP)

A high-performance, real-time situational awareness and volunteer deployment platform designed for large-scale events, festivals, and emergency crowd management.

---

## 🛠️ Stack

- **Frontend**: React, Vite, Tailwind CSS, Axios, Lucide React icons
- **Backend**: Python FastAPI, SQLite, SQLAlchemy, Pydantic

---

## 📁 Project Architecture

```
event-volunteer-platform/
├── backend/
│   ├── main.py              # FastAPI REST endpoints & CORS configuration
│   ├── models.py            # SQLAlchemy database models (Event, Role, Volunteer, Shift, Task, etc.)
│   ├── schemas.py           # Pydantic schemas for data validation
│   ├── database.py          # SQLite engine & session management
│   ├── crud.py              # Business logic, algorithmic skill matching, & seed data
│   ├── event_platform.db    # SQLite database file
│   └── requirements.txt     # Python backend dependencies
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx           # Top header, event selector & live connection status
    │   │   ├── Dashboard.jsx        # Requirement 6: Coordination Dashboard & Zone Radar
    │   │   ├── EventSetup.jsx       # Requirement 1: Event & Role setup with headcount quotas
    │   │   ├── ShiftAssignment.jsx  # Requirement 2: Skill-based shift matching engine
    │   │   ├── VolunteerRoster.jsx  # Requirement 3: Volunteer profiles & gate check-in/out
    │   │   ├── TaskBoard.jsx        # Requirement 4: Live dispatch Kanban board
    │   │   └── IncidentCenter.jsx   # Requirement 5: Broadcast announcements & escalations
    │   ├── services/
    │   │   └── api.js               # Centralized Axios API client
    │   ├── App.jsx                  # Main coordinator & reactive state
    │   └── index.css                # Tailwind CSS styling tokens
    ├── package.json
    └── vite.config.js
```

---

## 🚀 Key Functional Features Implemented

1. **Event and Role Setup**:
   - Create events with venue locations, timeframes, and descriptions.
   - Define role requirements (Crowd Safety Marshal, First Aid Responder, VIP Escort, Registration, Logistics) with specialized skill requirements and headcount quotas.

2. **Skill-Based Shift Assignment**:
   - Schedule shifts mapped to venue zones (North Gate, Main Stage, Medical Tent, Food Court, etc.).
   - Algorithmic recommendation engine scoring volunteers based on skill compatibility (CPR, Crowd Management, Multilingual) and check-in presence.
   - Fast 1-click assignment and unassignment with capacity enforcement.

3. **Volunteer Profiles & Check-In/Check-Out**:
   - Volunteer roster with skill tag chips, contact details, and emergency contacts (ICE).
   - Fast 1-click Check-In / Check-Out buttons with live timestamp tracking.
   - Search filter by volunteer name, skill keyword, or status.

4. **Live Task Board (Kanban)**:
   - Three-column workflow: `To Do`, `In Progress`, `Completed`.
   - Cards display venue zone, priority levels (`Urgent`, `High`, `Medium`, `Low`), and assigned personnel.
   - 1-click stage progression and dispatch creation.

5. **Announcements & Escalations**:
   - Broadcast emergency alerts and operational updates to volunteers with priority badges.
   - Crowd incident escalation queue tracking bottlenecks, medical alerts, and security concerns with resolution status tracking.

6. **Coordination Dashboard**:
   - Real-time KPI summary (Total volunteers, check-in ratio, shift staffing coverage, active tasks, critical alerts).
   - Dynamic **Crowd Zone Safety & Deployment Radar** showing staffing density and risk indicators (`Normal`, `Attention Needed`, `Critical Surge`).
   - 1-click "Reset Demo Data" for hackathon judging demonstrations.

---

## 🏃 Quick Start Guide

### 1. Backend (FastAPI + SQLite)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at: `http://127.0.0.1:8000/docs`

### 2. Frontend (React + Vite + Tailwind CSS)
```bash
cd frontend
npm install
npm run dev
```
Web App will be available at: `http://localhost:5173`

---

## 🔗 Live Jira Integration

EVCP features a **real, two-way, live integration** with Atlassian Jira Cloud using the official Jira REST API v3. Tasks managed in the EVCP Kanban board communicate directly with the real Jira project without simulation or fake mock endpoints.

### 1. Jira Project & Workflow
- **Project Name**: `EVCP — Event Volunteer & Crowd Coordination Platform`
- **Project Key**: `EVCP`
- **Workflow Statuses**:
  - `To Do` ↔ EVCP `OPEN`
  - `In Progress` ↔ EVCP `IN_PROGRESS`
  - `Done` ↔ EVCP `RESOLVED`

### 2. Required Environment Variables
Set the following variables in your root `.env` file (or provide them via your execution environment):

```env
# Jira Cloud Integration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USER_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=EVCP
```
> **Security Note**: Never commit your real `.env` file or API token to version control. The `.env` file is protected in `.gitignore`.

### 3. How to Create & Configure Jira API Credentials
1. Log in to your Atlassian account at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).
2. Navigate to **Security** → **API tokens**.
3. Click **Create API token**, label it `EVCP-Integration`, and copy the generated token string.
4. Paste the token into `JIRA_API_TOKEN` in your `.env` file alongside your account email and domain URL.

### 4. How Issue Mapping Works
- Each EVCP task stores its persistent mapping in the local database schema:
  - `jira_issue_key`: e.g. `EVCP-36`
  - `jira_issue_id`: Unique numerical Jira issue ID
  - `jira_synced_at`: UTC timestamp of the latest successful sync
- Duplicate prevention: Repeated syncs will never create duplicate Jira tickets. Existing linked keys are detected and updated in-place.
- Issue URL generation: The API dynamically returns direct links (`https://<domain>.atlassian.net/browse/EVCP-XX`) for seamless 1-click inspection.

### 5. EVCP → Jira Synchronization
- **New Task Creation**: When creating a task in EVCP with Jira enabled, the backend automatically issues a `POST /rest/api/3/issue` call to create a real Jira issue in project `EVCP` and persists the generated key.
- **Status Updates**: When moving a task from `To Do` → `In Progress` or `In Progress` → `Done`, EVCP dynamically queries available workflow transitions for that issue (`GET /rest/api/3/issue/{key}/transitions`) and executes the corresponding transition (`POST /rest/api/3/issue/{key}/transitions`).
- **User Feedback**: The UI immediately displays a confirmation toast:
  - `Status changed to IN_PROGRESS. ✓ Jira EVCP-XX synchronized.`

### 6. Jira → EVCP Synchronization
When changes occur directly on the real Jira board (e.g. dragging a card to In Progress or Done):
- **On-Demand Card Sync**: Click the **Sync** button on any linked task card to immediately fetch the issue state from Jira Cloud (`GET /rest/api/3/issue/{key}`) and reconcile local status.
- **Global Board Sync**: Click the **Sync Jira** button in the header toolbar to scan all linked tasks and pull latest remote changes.
- **Automated Background Poller**: The backend background checker periodically polls linked Jira issues and syncs external status modifications.

### 7. Jira Cloud Webhook Setup
To enable instantaneous push updates from Jira Cloud to EVCP:
1. In Jira, navigate to **Settings** → **System** → **Webhooks**.
2. Click **Create a Webhook**.
3. Enter the Webhook URL: `https://<your-public-domain-or-tunnel>/api/jira/webhook`.
4. Under **Issue related events**, select **Issue** → **Updated**.
5. Save the webhook. Incoming webhooks parse the issue key and status change, automatically update the local database, and safeguard against recursive loop calls.

### 8. Local Development & Testing
Run unit and integration tests with pytest:
```bash
cd backend
python -m pytest test_jira.py -v
```

Verify Jira connectivity via health endpoint:
```bash
curl http://localhost:8000/api/jira/status
```

### 9. Docker Deployment
Start the entire integrated stack including backend, frontend, Prometheus, and Grafana:
```bash
docker compose up --build -d
```
All Jira configuration parameters from `.env` are automatically forwarded into the backend container.

### 10. Troubleshooting
- **Jira Status shows `connected: false`**: Verify `JIRA_BASE_URL` contains the full `https://` prefix, your user email is valid, and the API token has not expired.
- **Transition Not Found**: Ensure the target issue is in a workflow status that permits moving to the requested column. Transitions are evaluated dynamically per Jira issue state.
- **410 Gone / Deprecated API Errors**: Jira Cloud v3 requires `/rest/api/3/search/jql` instead of legacy search endpoints. The EVCP `jira_service` uses official v3 endpoints.
