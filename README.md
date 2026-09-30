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
