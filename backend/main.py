import asyncio
import time
import os
import sys
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone
from dotenv import load_dotenv

# Search for .env files automatically
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from fastapi import FastAPI, Depends, HTTPException, Query, Request, Response, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Gauge, Counter, generate_latest, CONTENT_TYPE_LATEST

from database import engine, Base, get_db, init_db, SessionLocal
import models, schemas, crud
import assignment_engine
from jira_service import jira_service
from github_service import github_service

# Standardize UTF-8 stdout so log lines with symbols don't crash cp1252 Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Initialize database tables and run lightweight migrations
init_db()

def sync_jira_tasks_from_cloud(db: Session):
    """Background helper to pull latest status changes from Jira Cloud for linked tasks."""
    if not jira_service.enabled:
        return
    linked_tasks = db.query(models.Task).filter(models.Task.jira_issue_key.isnot(None)).all()
    for task in linked_tasks:
        try:
            issue_data = jira_service.get_issue(task.jira_issue_key)
            if not issue_data:
                continue
            status_name = issue_data.get("fields", {}).get("status", {}).get("name", "")
            mapped_status = jira_service.map_jira_to_evcp_status(status_name)
            if task.status != mapped_status:
                old_status = task.status
                task.status = mapped_status
                task.jira_synced_at = datetime.utcnow()
                db.commit()
                print(f"[Jira Sync] Synced task #{task.id} ({task.jira_issue_key}) from {old_status} to {mapped_status} (Jira: {status_name})")
        except Exception as e:
            pass

def build_runtime_snapshot(db: Session) -> dict:
    """Point-in-time platform state that is published to GitHub Actions as a runtime report."""
    m = crud.get_dashboard_metrics(db)
    keys = (
        "active_event_name", "total_volunteers", "checked_in_volunteers", "total_shifts", "filled_shifts",
        "coverage_gaps_count", "open_tasks", "in_progress_tasks", "resolved_tasks", "open_issues",
        "critical_issues", "escalated_issues_count", "no_shows_count",
    )
    snapshot = {k: m.get(k) for k in keys}
    snapshot["jira"] = {"enabled": jira_service.enabled, "project": jira_service.project_key}
    snapshot["reported_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return snapshot

def send_github_report(event: str) -> dict:
    """Build a snapshot and dispatch the runtime-report workflow (blocking; call from a thread)."""
    db = SessionLocal()
    try:
        snapshot = build_runtime_snapshot(db)
    finally:
        db.close()
    result = github_service.dispatch_report(event, snapshot)
    GITHUB_DISPATCHES_TOTAL.labels(result="success" if result["ok"] else "failure").inc()
    return result

async def run_periodic_checker():
    """Runs approximately every 10 seconds in background using a fresh SQLAlchemy session."""
    counter = 0
    last_github_report = time.monotonic()
    while True:
        try:
            await asyncio.sleep(10)
            counter += 1
            def run_sync_checks():
                nonlocal last_github_report
                db = SessionLocal()
                try:
                    crud.check_issue_escalations(db)
                    crud.check_no_shows(db)
                    # Every 20 seconds, poll linked Jira issues for status updates
                    if counter % 2 == 0 and jira_service.enabled:
                        sync_jira_tasks_from_cloud(db)
                except Exception as e:
                    print(f"Periodic check error: {e}")
                finally:
                    db.close()
                # Optional heartbeat report to GitHub Actions (GITHUB_REPORT_INTERVAL_MIN, 0 = off)
                interval = github_service.heartbeat_minutes * 60
                if interval > 0 and github_service.can_dispatch and time.monotonic() - last_github_report >= interval:
                    last_github_report = time.monotonic()
                    send_github_report("heartbeat")
            await asyncio.to_thread(run_sync_checks)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Periodic loop note: {e}")
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    db = SessionLocal()
    try:
        crud.seed_initial_data(db)
    finally:
        db.close()

    checker_task = asyncio.create_task(run_periodic_checker())
    if github_service.report_on_startup and github_service.can_dispatch:
        asyncio.create_task(asyncio.to_thread(send_github_report, "startup"))
    try:
        yield
    finally:
        checker_task.cancel()
        try:
            await checker_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="Event Volunteer & Crowd Coordination Platform API",
    description="Backend for Event Volunteer & Crowd Coordination Platform",
    version="1.0.0",
    lifespan=lifespan
)

# ----------------- PROMETHEUS METRICS INSTRUMENTATION -----------------
# Business Gauges (Point-in-time application state)
VOLUNTEERS_TOTAL = Gauge("evcp_volunteers_total", "Total registered volunteers")
VOLUNTEERS_CHECKED_IN = Gauge("evcp_volunteers_checked_in", "Total currently checked-in volunteers")
SHIFTS_ACTIVE = Gauge("evcp_shifts_active", "Total active operational shifts")
ISSUES_OPEN = Gauge("evcp_issues_open", "Total open or in-progress incident issues")
ISSUES_ESCALATED = Gauge("evcp_issues_escalated", "Total escalated issues with escalation level > 0")
COVERAGE_GAPS = Gauge("evcp_coverage_gaps_total", "Total unfilled volunteer slots across active shifts")

# Cumulative Business Counters
CHECKINS_TOTAL = Counter("evcp_checkins_total", "Cumulative total volunteer check-ins processed")
CHECKOUTS_TOTAL = Counter("evcp_checkouts_total", "Cumulative total volunteer check-outs processed")
INCIDENTS_REPORTED_TOTAL = Counter("evcp_incidents_reported_total", "Cumulative total incidents reported")
AUTO_ASSIGNMENTS_TOTAL = Counter("evcp_auto_assignments_total", "Cumulative total automatic shift assignments executed")
GITHUB_DISPATCHES_TOTAL = Counter("evcp_github_dispatches_total", "Runtime reports dispatched to GitHub Actions", ["result"])

# Standard HTTP metrics (request duration, request count, status codes, in-progress)
instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/metrics", "/health"],
    inprogress_name="http_requests_inprogress",
    inprogress_labels=True,
)
instrumentator.instrument(app)

def update_business_metrics(db: Session):
    """Refreshes real-time gauges from the database state."""
    try:
        metrics = crud.get_dashboard_metrics(db)
        VOLUNTEERS_TOTAL.set(metrics.get("total_volunteers", 0))
        VOLUNTEERS_CHECKED_IN.set(metrics.get("checked_in_volunteers", 0))
        SHIFTS_ACTIVE.set(metrics.get("total_shifts", 0))
        ISSUES_OPEN.set(metrics.get("open_issues", 0))
        ISSUES_ESCALATED.set(metrics.get("escalated_issues_count", 0))
        COVERAGE_GAPS.set(metrics.get("coverage_gaps_count", 0))
    except Exception as e:
        print(f"Error collecting Prometheus business metrics: {e}")

# Uploaded event cover images, referenced by Event.image_url ("/uploads/events/...")
os.makedirs(crud.EVENT_IMAGE_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=crud.UPLOAD_DIR), name="uploads")

# Enable CORS (configurable via CORS_ORIGINS environment variable)
cors_origins_raw = os.getenv("CORS_ORIGINS", "*")
if cors_origins_raw.strip() == "*":
    allow_origins = ["*"]
else:
    allow_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Event Volunteer & Crowd Coordination API",
        "docs_url": "/docs"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "Event Volunteer & Crowd Coordination API",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/metrics")
def get_metrics(db: Session = Depends(get_db)):
    """Exposes Prometheus-formatted HTTP and application business metrics."""
    update_business_metrics(db)
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ----------------- 1. EVENT & ROLE SETUP -----------------
@app.get("/api/events", response_model=List[schemas.EventOut])
def read_events(
    category: Optional[str] = Query(None, description="Filter by category (case-insensitive)"),
    featured: Optional[bool] = Query(None),
    status: Optional[str] = Query(None, description="Upcoming, Active or Completed"),
    search: Optional[str] = Query(None, description="Match name, location or description"),
    limit: Optional[int] = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    return crud.get_events(db, category=category, featured=featured, status=status, search=search, limit=limit, offset=offset)

@app.get("/api/events/categories", response_model=List[schemas.EventCategoryOut])
def read_event_categories(db: Session = Depends(get_db)):
    """Distinct categories in use, derived from stored events."""
    return crud.get_event_categories(db)

@app.get("/api/skills", response_model=List[str])
def read_known_skills(db: Session = Depends(get_db)):
    """Skill vocabulary from roles, shifts and volunteer profiles."""
    return crud.get_known_skills(db)

@app.get("/api/events/{event_id}", response_model=schemas.EventOut)
def read_event(event_id: int, db: Session = Depends(get_db)):
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@app.get("/api/events/{event_id}/details")
def read_event_details(event_id: int, db: Session = Depends(get_db)):
    """Event with zones, roles, shifts (with coverage), assigned volunteers and open shifts."""
    details = crud.get_event_details(db, event_id)
    if not details:
        raise HTTPException(status_code=404, detail="Event not found")
    return details

@app.post("/api/events", response_model=schemas.EventOut, status_code=status.HTTP_201_CREATED)
def create_new_event(event: schemas.EventCreate, db: Session = Depends(get_db)):
    return crud.create_event(db, event)

@app.put("/api/events/{event_id}", response_model=schemas.EventOut)
def update_event_details(event_id: int, event: schemas.EventUpdate, db: Session = Depends(get_db)):
    try:
        updated = crud.update_event(db, event_id, event)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="Event not found")
    return updated

@app.put("/api/events/{event_id}/image", response_model=schemas.EventOut)
async def upload_event_image(event_id: int, request: Request, db: Session = Depends(get_db)):
    """Store a cover image sent as the raw request body (Content-Type: image/*)."""
    declared = int(request.headers.get("content-length") or 0)
    if declared > crud.MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")
    data = await request.body()
    try:
        updated = crud.save_event_image(db, event_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="Event not found")
    return updated

@app.delete("/api/events/{event_id}/image", response_model=schemas.EventOut)
def delete_event_image(event_id: int, db: Session = Depends(get_db)):
    updated = crud.remove_event_image(db, event_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Event not found")
    return updated

# --- Zones (per event) ---
@app.get("/api/events/{event_id}/zones", response_model=List[schemas.ZoneOut])
def read_zones(event_id: int, db: Session = Depends(get_db)):
    return crud.get_zones_by_event(db, event_id)

@app.get("/api/events/{event_id}/zone-names", response_model=List[str])
def read_zone_names(event_id: int, db: Session = Depends(get_db)):
    """Defined zones plus zones already referenced by the event's shifts, tasks and issues."""
    return crud.get_event_zone_names(db, event_id)

@app.post("/api/events/{event_id}/zones", response_model=schemas.ZoneOut, status_code=status.HTTP_201_CREATED)
def create_new_zone(event_id: int, zone: schemas.ZoneCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_zone(db, event_id, zone)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/zones/{zone_id}", response_model=schemas.ZoneOut)
def update_zone_details(zone_id: int, zone: schemas.ZoneCreate, db: Session = Depends(get_db)):
    try:
        updated = crud.update_zone(db, zone_id, zone)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="Zone not found")
    return updated

@app.delete("/api/zones/{zone_id}")
def delete_zone_item(zone_id: int, db: Session = Depends(get_db)):
    if not crud.delete_zone(db, zone_id):
        raise HTTPException(status_code=404, detail="Zone not found")
    return {"message": "Zone deleted"}

# --- Roles (per event) ---
@app.get("/api/events/{event_id}/roles", response_model=List[schemas.RoleOut])
def read_roles(event_id: int, db: Session = Depends(get_db)):
    return crud.get_roles_by_event(db, event_id)

@app.post("/api/roles", response_model=schemas.RoleOut, status_code=status.HTTP_201_CREATED)
def create_new_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_role(db, role)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.put("/api/roles/{role_id}", response_model=schemas.RoleOut)
def update_role_details(role_id: int, role: schemas.RoleUpdate, db: Session = Depends(get_db)):
    try:
        updated = crud.update_role(db, role_id, role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="Role not found")
    return updated

@app.delete("/api/roles/{role_id}")
def delete_role_item(role_id: int, db: Session = Depends(get_db)):
    if not crud.delete_role(db, role_id):
        raise HTTPException(status_code=404, detail="Role not found")
    return {"message": "Role deleted"}


# ----------------- 2. VOLUNTEER PROFILES & ATTENDANCE TRACKING -----------------
@app.get("/volunteers", response_model=List[schemas.VolunteerOut])
@app.get("/api/volunteers", response_model=List[schemas.VolunteerOut])
def read_volunteers(
    search: Optional[str] = Query(None, description="Search by name, skills or email"),
    status: Optional[str] = Query(None, description="Filter by status: Available, Checked In, Checked Out"),
    db: Session = Depends(get_db)
):
    return crud.get_volunteers(db, search=search, status=status)

@app.post("/volunteers", response_model=schemas.VolunteerOut, status_code=status.HTTP_201_CREATED)
@app.post("/api/volunteers", response_model=schemas.VolunteerOut, status_code=status.HTTP_201_CREATED)
def register_volunteer(volunteer: schemas.VolunteerCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Volunteer).filter(models.Volunteer.email == volunteer.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Volunteer email already registered")
    return crud.create_volunteer(db, volunteer)

@app.get("/volunteers/{volunteer_id}", response_model=schemas.VolunteerDetailOut)
@app.get("/api/volunteers/{volunteer_id}", response_model=schemas.VolunteerDetailOut)
def read_volunteer(volunteer_id: int, db: Session = Depends(get_db)):
    vol = crud.get_volunteer_detail(db, volunteer_id)
    if not vol:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return vol

@app.put("/volunteers/{volunteer_id}", response_model=schemas.VolunteerOut)
@app.put("/api/volunteers/{volunteer_id}", response_model=schemas.VolunteerOut)
def update_volunteer_profile(
    volunteer_id: int,
    data: schemas.VolunteerUpdate,
    db: Session = Depends(get_db)
):
    vol = crud.update_volunteer(db, volunteer_id, data)
    if not vol:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return vol

@app.post("/volunteers/{volunteer_id}/check-in", response_model=schemas.CheckInResponse)
@app.post("/api/volunteers/{volunteer_id}/check-in", response_model=schemas.CheckInResponse)
def volunteer_check_in(volunteer_id: int, db: Session = Depends(get_db)):
    vol, record_or_err = crud.check_in_volunteer(db, volunteer_id)
    if not vol:
        if record_or_err == "Volunteer not found":
            raise HTTPException(status_code=404, detail=record_or_err)
        # Duplicate check-in prevention
        raise HTTPException(status_code=400, detail=record_or_err)

    CHECKINS_TOTAL.inc()
    return {
        "volunteer_id": vol.id,
        "volunteer_name": vol.full_name,
        "name": vol.full_name,
        "check_in_time": record_or_err.check_in_time,
        "status": vol.status,
        "message": f"Volunteer '{vol.full_name}' checked in successfully at {record_or_err.check_in_time}"
    }

@app.post("/volunteers/{volunteer_id}/check-out", response_model=schemas.CheckOutResponse)
@app.post("/api/volunteers/{volunteer_id}/check-out", response_model=schemas.CheckOutResponse)
def volunteer_check_out(volunteer_id: int, db: Session = Depends(get_db)):
    vol, record, err_or_hours = crud.check_out_volunteer(db, volunteer_id)
    if not vol:
        if err_or_hours == "Volunteer not found":
            raise HTTPException(status_code=404, detail=err_or_hours)
        # Prevent checkout if not checked in
        raise HTTPException(status_code=400, detail=err_or_hours)

    CHECKOUTS_TOTAL.inc()
    return {
        "volunteer_id": vol.id,
        "volunteer_name": vol.full_name,
        "name": vol.full_name,
        "check_in_time": record.check_in_time,
        "check_out_time": record.check_out_time,
        "hours_worked": err_or_hours,
        "total_hours_worked": vol.total_hours_worked,
        "status": vol.status,
        "message": f"Volunteer '{vol.full_name}' checked out successfully. Session: {err_or_hours}h. Total: {vol.total_hours_worked}h"
    }

# --- Volunteer Availability Slots ---
@app.get("/volunteers/{volunteer_id}/availability", response_model=List[schemas.AvailabilityOut])
@app.get("/api/volunteers/{volunteer_id}/availability", response_model=List[schemas.AvailabilityOut])
def get_volunteer_availability(volunteer_id: int, db: Session = Depends(get_db)):
    return crud.get_volunteer_availabilities(db, volunteer_id)

@app.post("/volunteers/{volunteer_id}/availability", response_model=schemas.AvailabilityOut, status_code=status.HTTP_201_CREATED)
@app.post("/api/volunteers/{volunteer_id}/availability", response_model=schemas.AvailabilityOut, status_code=status.HTTP_201_CREATED)
def add_volunteer_availability(volunteer_id: int, avail: schemas.AvailabilityCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_volunteer_availability(db, volunteer_id, avail)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/volunteers/availability/{avail_id}", response_model=schemas.AvailabilityOut)
@app.put("/api/volunteers/availability/{avail_id}", response_model=schemas.AvailabilityOut)
def edit_volunteer_availability(avail_id: int, avail: schemas.AvailabilityCreate, db: Session = Depends(get_db)):
    try:
        updated = crud.update_volunteer_availability(db, avail_id, avail)
        if not updated:
            raise HTTPException(status_code=404, detail="Availability slot not found")
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/volunteers/availability/{avail_id}")
@app.delete("/api/volunteers/availability/{avail_id}")
def remove_volunteer_availability(avail_id: int, db: Session = Depends(get_db)):
    if not crud.delete_volunteer_availability(db, avail_id):
        raise HTTPException(status_code=404, detail="Availability slot not found")
    return {"message": "Availability slot deleted successfully"}



# ----------------- 3. SKILL-BASED SHIFT ASSIGNMENT -----------------
@app.get("/api/events/{event_id}/shifts", response_model=List[schemas.ShiftOut])
def read_shifts(event_id: int, db: Session = Depends(get_db)):
    return crud.get_shifts_by_event(db, event_id)

@app.post("/api/shifts", response_model=schemas.ShiftOut, status_code=status.HTTP_201_CREATED)
def create_new_shift(shift: schemas.ShiftCreate, db: Session = Depends(get_db)):
    return crud.create_shift(db, shift)

@app.post("/api/shifts/assign")
@app.post("/shifts/assign")
@app.post("/api/assignments/assign")
@app.post("/assignments/assign")
@app.post("/api/assignments")
@app.post("/assignments")
def assign_shift(req: schemas.AssignShiftRequest, db: Session = Depends(get_db)):
    shift = db.query(models.Shift).filter(models.Shift.id == req.shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    vol = db.query(models.Volunteer).filter(models.Volunteer.id == req.volunteer_id).first()
    if not vol:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    assignment = crud.assign_volunteer_to_shift(db, req.shift_id, req.volunteer_id)
    cov = assignment_engine.calculate_coverage(shift)
    return {
        "message": "Volunteer assigned to shift successfully",
        "assignment_id": assignment.id,
        "shift_id": req.shift_id,
        "volunteer_id": req.volunteer_id,
        "coverage": cov
    }

@app.delete("/api/shifts/assignments/{assignment_id}")
@app.delete("/shifts/assignments/{assignment_id}")
@app.delete("/api/assignments/{assignment_id}")
@app.delete("/assignments/{assignment_id}")
def unassign_shift(assignment_id: int, db: Session = Depends(get_db)):
    success = crud.remove_shift_assignment(db, assignment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Shift assignment not found")
    return {"message": "Shift assignment removed"}

@app.get("/shifts/{shift_id}/suggestions", response_model=List[schemas.ShiftSuggestionOut])
@app.get("/api/shifts/{shift_id}/suggestions", response_model=List[schemas.ShiftSuggestionOut])
def get_shift_top_suggestions(shift_id: int, db: Session = Depends(get_db)):
    """Return top 3 eligible volunteers for that shift using weighted rule scoring model."""
    suggestions = assignment_engine.get_shift_suggestions(db, shift_id, limit=3)
    return suggestions

@app.get("/api/shifts/{shift_id}/recommendations")
def get_shift_recommendations(shift_id: int, db: Session = Depends(get_db)):
    """Return full recommendation list for modal integration."""
    suggestions = assignment_engine.get_shift_suggestions(db, shift_id, limit=10)
    result = []
    for s in suggestions:
        result.append({
            "id": s["volunteer_id"],
            "full_name": s["volunteer_name"],
            "skills": ", ".join(s["matched_skills"]) if s["matched_skills"] else (s.get("skills") or "General"),
            "status": s["availability"],
            "match_score": s["score"],
            "is_assigned": False,
            "matching_skills": s["matched_skills"],
            "is_checked_in": "Checked In" in s["availability"],
            "conflict_status": s["conflict_status"],
            "current_workload": s["current_workload"],
            "reason": s["reason"],
            "score_breakdown": s.get("score_breakdown")
        })
    return result

@app.post("/assignments/auto-assign")
@app.post("/api/assignments/auto-assign")
def auto_assign_volunteers(
    req: schemas.AutoAssignRequest = schemas.AutoAssignRequest(),
    db: Session = Depends(get_db)
):
    """Automatically assign volunteers to a shift or all shifts based on weighted scores."""
    AUTO_ASSIGNMENTS_TOTAL.inc()
    if req.shift_id:
        shift = db.query(models.Shift).filter(models.Shift.id == req.shift_id).first()
        if not shift:
            raise HTTPException(status_code=404, detail="Shift not found")
        result = assignment_engine.auto_assign_shift(db, shift)
        return {"message": "Shift auto-assigned successfully", "results": [result]}
    else:
        results = assignment_engine.auto_assign_all_shifts(db, req.event_id)
        return {"message": "All shifts auto-assigned successfully", "results": results}

@app.get("/assignments")
@app.get("/api/assignments")
def get_current_assignments(
    event_id: Optional[int] = Query(None),
    shift_id: Optional[int] = Query(None),
    volunteer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Return current active shift assignments. Supports filtering by event_id, shift_id, volunteer_id."""
    # When filtering by a specific volunteer, include all their assignments not just active ones
    if volunteer_id:
        query = db.query(models.ShiftAssignment).filter(
            models.ShiftAssignment.volunteer_id == volunteer_id
        )
        if shift_id:
            query = query.filter(models.ShiftAssignment.shift_id == shift_id)
        assignments = query.all()
        if event_id:
            assignments = [a for a in assignments if a.shift and a.shift.event_id == event_id]
    else:
        query = db.query(models.ShiftAssignment).filter(
            models.ShiftAssignment.status.in_(["Assigned", "Confirmed", "Checked In"])
        )
        if shift_id:
            query = query.filter(models.ShiftAssignment.shift_id == shift_id)
        assignments = query.all()
        if event_id:
            assignments = [a for a in assignments if a.shift and a.shift.event_id == event_id]

    results = []
    for a in assignments:
        results.append({
            "assignment_id": a.id,
            "shift_id": a.shift_id,
            "shift_title": a.shift.title if a.shift else "Unknown Shift",
            "shift_start": a.shift.start_time if a.shift else "",
            "shift_end": a.shift.end_time if a.shift else "",
            "shift_date": a.shift.date if a.shift else "",
            "zone": a.shift.zone if a.shift else "General",
            "volunteer_id": a.volunteer_id,
            "volunteer_name": a.volunteer.full_name if a.volunteer else "Unknown Volunteer",
            "volunteer_skills": a.volunteer.skills if a.volunteer else "",
            "volunteer_status": a.volunteer.status if a.volunteer else "",
            "status": a.status,
            "assignment_status": a.assignment_status or a.status,
            "assigned_at": a.assigned_at
        })
    return results

@app.post("/assignments/rebalance")
@app.post("/api/assignments/rebalance")
def rebalance_staffing(
    req: schemas.RebalanceRequest = schemas.RebalanceRequest(),
    db: Session = Depends(get_db)
):
    """Identify understaffed shifts/zones and suggest/apply eligible volunteer transfers."""
    result = assignment_engine.rebalance_assignments(db, req.event_id, req.apply or False)
    return result

@app.post("/assignments/rebalance/accept")
@app.post("/api/assignments/rebalance/accept")
def accept_rebalance_move(
    req: schemas.RebalanceAcceptRequest,
    db: Session = Depends(get_db)
):
    """Coordinator accepts a specific rebalancing suggestion to transfer a volunteer between shifts."""
    from_id = req.from_shift_id or req.source_shift_id
    to_id = req.to_shift_id or req.target_shift_id
    result = assignment_engine.apply_single_rebalance(
        db,
        volunteer_id=req.volunteer_id,
        from_shift_id=from_id,
        to_shift_id=to_id
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/assignments/dropout")
@app.post("/api/assignments/dropout")
@app.post("/shifts/{shift_id}/dropout")
@app.post("/api/shifts/{shift_id}/dropout")
def volunteer_dropout(
    req: schemas.DropoutRequest,
    shift_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Mark volunteer unavailable for shift, remove active assignment, recalculate coverage, and return replacement suggestions."""
    target_shift_id = shift_id or req.shift_id
    result = assignment_engine.handle_volunteer_dropout(db, target_shift_id, req.volunteer_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@app.post("/assignments/no-show/check")
@app.post("/api/assignments/no-show/check")
def trigger_no_show_check(req: Optional[schemas.TimeInjectRequest] = None, db: Session = Depends(get_db)):
    """Trigger automatic no-show detection with optional injected time for deterministic testing."""
    now_dt = None
    if req and req.now:
        now_dt = req.now
    results = crud.check_no_shows(db, now=now_dt)
    return {
        "checked_at": str(now_dt or "now"),
        "no_shows_detected_count": len(results),
        "no_shows": results
    }


# ----------------- 4. LIVE TASK BOARD -----------------
@app.get("/tasks", response_model=List[schemas.TaskOut])
@app.get("/api/tasks", response_model=List[schemas.TaskOut])
def read_all_tasks(
    event_id: Optional[int] = Query(None),
    zone: Optional[str] = Query(None),
    volunteer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieve tasks with volunteer details, zone, priority, status, and timestamps."""
    return crud.get_tasks(db, event_id=event_id, zone=zone, volunteer_id=volunteer_id)

@app.get("/events/{event_id}/tasks", response_model=List[schemas.TaskOut])
@app.get("/api/events/{event_id}/tasks", response_model=List[schemas.TaskOut])
def read_event_tasks(
    event_id: int,
    zone: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return crud.get_tasks_by_event(db, event_id, zone=zone)

@app.post("/tasks", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
@app.post("/api/tasks", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_new_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    try:
        new_task = crud.create_task(db, task)
        # Create Jira issue if enabled
        if jira_service.enabled:
            try:
                jira_res = jira_service.create_issue(
                    title=new_task["title"],
                    description=new_task["description"],
                    priority=new_task["priority"]
                )
                if jira_res and "key" in jira_res and "id" in jira_res:
                    update_data = schemas.TaskUpdate(
                        jira_issue_key=jira_res["key"],
                        jira_issue_id=jira_res["id"],
                        jira_synced_at=datetime.utcnow()
                    )
                    new_task = crud.update_task(db, new_task["id"], update_data)
                    new_task["jira_sync_status"] = "synced"
                    # If initial status is not OPEN (e.g. IN_PROGRESS), transition Jira issue
                    if new_task["status"] != "OPEN":
                        jira_service.transition_issue(jira_res["key"], new_task["status"])
                else:
                    new_task["jira_sync_status"] = "failed"
            except Exception as ex:
                print(f"Jira issue creation error: {ex}")
                new_task["jira_sync_status"] = "failed"
        else:
            new_task["jira_sync_status"] = "disabled"
        return new_task
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

@app.put("/tasks/{task_id}", response_model=schemas.TaskOut)
@app.put("/api/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task_details(task_id: int, task_data: schemas.TaskUpdate, db: Session = Depends(get_db)):
    try:
        existing_task = db.query(models.Task).filter(models.Task.id == task_id).first()
        if not existing_task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
            
        status_changed = bool(task_data.status and task_data.status != existing_task.status)
        
        updated = crud.update_task(db, task_id, task_data)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
        # Sync to Jira if status changed and it's linked
        if updated.get("jira_issue_key") and jira_service.enabled:
            if status_changed:
                trans_ok = jira_service.transition_issue(updated["jira_issue_key"], updated["status"])
                if trans_ok:
                    crud.update_task(db, task_id, schemas.TaskUpdate(jira_synced_at=datetime.utcnow()))
                    updated["jira_sync_status"] = "synced"
                else:
                    updated["jira_sync_status"] = "failed"
            else:
                updated["jira_sync_status"] = "unchanged"
        else:
            updated["jira_sync_status"] = "not_linked" if not updated.get("jira_issue_key") else "disabled"
            
        return updated
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

@app.post("/tasks/{task_id}/jira/sync")
@app.post("/api/tasks/{task_id}/jira/sync")
def sync_task_with_jira(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not jira_service.enabled:
        raise HTTPException(status_code=400, detail="Jira integration is not configured")

    if not db_task.jira_issue_key:
        # Create it in Jira
        jira_res = jira_service.create_issue(
            title=db_task.title,
            description=db_task.description or "",
            priority=db_task.priority or "MEDIUM"
        )
        if jira_res and "key" in jira_res and "id" in jira_res:
            db_task.jira_issue_key = jira_res["key"]
            db_task.jira_issue_id = jira_res["id"]
            db_task.jira_synced_at = datetime.utcnow()
            db.commit()
            db.refresh(db_task)
            
            # Match current status if not OPEN
            if db_task.status != "OPEN":
                jira_service.transition_issue(jira_res["key"], db_task.status)
                
            return {
                "status": "created",
                "message": f"Created Jira issue {jira_res['key']}",
                "jira_issue_key": jira_res["key"],
                "jira_issue_url": jira_service.get_issue_url(jira_res["key"]),
                "task": crud.format_task(db_task)
            }
        raise HTTPException(status_code=500, detail="Failed to create Jira issue")
    else:
        # Check current status in Jira
        jira_issue = jira_service.get_issue(db_task.jira_issue_key)
        if jira_issue:
            jira_status_name = jira_issue.get("fields", {}).get("status", {}).get("name", "")
            mapped_status = jira_service.map_jira_to_evcp_status(jira_status_name)
            
            if db_task.status != mapped_status:
                old_status = db_task.status
                db_task.status = mapped_status
                db_task.jira_synced_at = datetime.utcnow()
                db.commit()
                db.refresh(db_task)
                return {
                    "status": "synchronized_from_jira",
                    "message": f"Updated EVCP task status from {old_status} to {mapped_status} (Jira: {jira_status_name})",
                    "jira_issue_key": db_task.jira_issue_key,
                    "new_status": mapped_status,
                    "jira_issue_url": jira_service.get_issue_url(db_task.jira_issue_key),
                    "task": crud.format_task(db_task)
                }
            else:
                # In sync, push status to Jira to verify
                jira_service.transition_issue(db_task.jira_issue_key, db_task.status)
                db_task.jira_synced_at = datetime.utcnow()
                db.commit()
                db.refresh(db_task)
                return {
                    "status": "in_sync",
                    "message": f"Task and Jira issue {db_task.jira_issue_key} are synchronized ({db_task.status})",
                    "jira_issue_key": db_task.jira_issue_key,
                    "jira_issue_url": jira_service.get_issue_url(db_task.jira_issue_key),
                    "task": crud.format_task(db_task)
                }
        else:
            success = jira_service.transition_issue(db_task.jira_issue_key, db_task.status)
            if success:
                db_task.jira_synced_at = datetime.utcnow()
                db.commit()
                return {
                    "status": "synchronized_to_jira",
                    "message": f"Pushed status {db_task.status} to Jira {db_task.jira_issue_key}",
                    "jira_issue_key": db_task.jira_issue_key,
                    "jira_issue_url": jira_service.get_issue_url(db_task.jira_issue_key),
                    "task": crud.format_task(db_task)
                }
            raise HTTPException(status_code=500, detail=f"Failed to access Jira issue {db_task.jira_issue_key}")

@app.post("/jira/sync")
@app.post("/api/jira/sync")
def sync_all_jira_tasks(db: Session = Depends(get_db)):
    if not jira_service.enabled:
        raise HTTPException(status_code=400, detail="Jira integration is not configured")
        
    linked_tasks = db.query(models.Task).filter(models.Task.jira_issue_key.isnot(None)).all()
    results = []
    updated_count = 0
    
    for task in linked_tasks:
        try:
            issue_data = jira_service.get_issue(task.jira_issue_key)
            if not issue_data:
                results.append({"task_id": task.id, "key": task.jira_issue_key, "status": "not_found"})
                continue
            jira_status_name = issue_data.get("fields", {}).get("status", {}).get("name", "")
            mapped_status = jira_service.map_jira_to_evcp_status(jira_status_name)
            if task.status != mapped_status:
                old = task.status
                task.status = mapped_status
                task.jira_synced_at = datetime.utcnow()
                db.commit()
                updated_count += 1
                results.append({"task_id": task.id, "key": task.jira_issue_key, "status": "updated", "from": old, "to": mapped_status})
            else:
                results.append({"task_id": task.id, "key": task.jira_issue_key, "status": "in_sync", "current": task.status})
        except Exception as e:
            results.append({"task_id": task.id, "key": task.jira_issue_key, "status": "error", "error": str(e)})
            
    return {
        "total_linked": len(linked_tasks),
        "updated": updated_count,
        "results": results
    }

@app.post("/jira/webhook")
@app.post("/api/jira/webhook")
async def jira_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    issue_data = payload.get("issue", {})
    issue_key = issue_data.get("key")
    issue_id = issue_data.get("id")
    
    if not issue_key and not issue_id:
        return {"status": "ignored", "reason": "No issue key or ID in payload"}
        
    status_name = issue_data.get("fields", {}).get("status", {}).get("name", "")
    if not status_name:
        changelog = payload.get("changelog", {})
        for item in changelog.get("items", []):
            if item.get("field") == "status":
                status_name = item.get("toString", "")
                break
                
    if not status_name:
        return {"status": "ignored", "reason": "No status found in webhook payload"}
        
    evcp_status = jira_service.map_jira_to_evcp_status(status_name)
    
    db_task = None
    if issue_key:
        db_task = db.query(models.Task).filter(models.Task.jira_issue_key == issue_key).first()
    if not db_task and issue_id:
        db_task = db.query(models.Task).filter(models.Task.jira_issue_id == str(issue_id)).first()
        
    if not db_task:
        return {"status": "ignored", "reason": f"No linked EVCP task found for {issue_key or issue_id}"}
        
    if db_task.status == evcp_status:
        return {"status": "unchanged", "reason": f"Task already in status {evcp_status}"}
        
    old_status = db_task.status
    db_task.status = evcp_status
    db_task.jira_synced_at = datetime.utcnow()
    db.commit()
    
    return {
        "status": "synchronized",
        "task_id": db_task.id,
        "jira_issue_key": db_task.jira_issue_key,
        "old_status": old_status,
        "new_status": evcp_status
    }

@app.get("/github/status")
@app.get("/api/github/status")
def get_github_status():
    """GitHub Actions connection info plus the most recent workflow runs."""
    runs = github_service.list_runs()
    return {**github_service.status(), "runsOk": runs["ok"], "runsError": runs.get("error"), "runs": runs["runs"]}

@app.post("/github/report")
@app.post("/api/github/report")
def post_github_report():
    """Dispatch the runtime-report workflow on GitHub Actions with the current platform snapshot."""
    if not github_service.can_dispatch:
        raise HTTPException(status_code=400, detail="GitHub Actions dispatch is not configured. Set GITHUB_TOKEN in backend/.env.")
    result = send_github_report("manual")
    if not result["ok"]:
        raise HTTPException(status_code=502, detail=result["error"])
    return {**result, "workflowUrl": github_service.status()["workflowUrl"]}

@app.get("/jira/status")
@app.get("/api/jira/status")
def get_jira_status():
    is_connected = False
    if jira_service.enabled:
        is_connected = jira_service.verify_access()
        
    return {
        "connected": is_connected,
        "enabled": jira_service.enabled,
        "projectKey": jira_service.project_key,
        "baseUrl": jira_service.base_url,
        "userEmail": jira_service.email
    }

@app.delete("/tasks/{task_id}")
@app.delete("/api/tasks/{task_id}")
def delete_task_item(task_id: int, db: Session = Depends(get_db)):
    if not crud.delete_task(db, task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return {"message": "Task deleted successfully"}


# ----------------- 5. INCIDENTS, ISSUES & ANNOUNCEMENTS -----------------
# --- Issues Endpoints ---
@app.get("/issues/escalated", response_model=List[schemas.EscalatedIssueOut])
@app.get("/api/issues/escalated", response_model=List[schemas.EscalatedIssueOut])
def read_escalated_issues(db: Session = Depends(get_db)):
    """Retrieve all escalated issues (escalation_level > 0). Declared before /{issue_id}."""
    return crud.get_escalated_issues(db)

@app.post("/issues/escalate/check")
@app.post("/api/issues/escalate/check")
def trigger_escalation_check(req: Optional[schemas.TimeInjectRequest] = None, db: Session = Depends(get_db)):
    """Trigger time-based SLA escalation check with optional injected time for deterministic testing."""
    now_dt = None
    if req and req.now:
        now_dt = req.now
    results = crud.check_issue_escalations(db, now=now_dt)
    return {
        "checked_at": str(now_dt or "now"),
        "escalated_count": len(results),
        "escalated": results
    }

@app.get("/issues", response_model=List[schemas.IssueOut])
@app.get("/api/issues", response_model=List[schemas.IssueOut])
def read_issues(
    event_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieve issues with optional filters for event_id, status, issue_type, zone, priority."""
    return crud.get_issues(
        db,
        event_id=event_id,
        status=status,
        issue_type=issue_type,
        zone=zone,
        priority=priority
    )

@app.post("/issues", response_model=schemas.IssueOut, status_code=status.HTTP_201_CREATED)
@app.post("/api/issues", response_model=schemas.IssueOut, status_code=status.HTTP_201_CREATED)
def create_new_issue(issue: schemas.IssueCreate, db: Session = Depends(get_db)):
    """Create a new issue with automatic coordinator routing."""
    res = crud.create_issue(db, issue)
    INCIDENTS_REPORTED_TOTAL.inc()
    return res

@app.get("/issues/{issue_id}", response_model=schemas.IssueOut)
@app.get("/api/issues/{issue_id}", response_model=schemas.IssueOut)
def read_single_issue(issue_id: int, db: Session = Depends(get_db)):
    iss = crud.get_issue(db, issue_id)
    if not iss:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    return iss

@app.put("/issues/{issue_id}", response_model=schemas.IssueOut)
@app.put("/api/issues/{issue_id}", response_model=schemas.IssueOut)
def update_issue_details(issue_id: int, issue_data: schemas.IssueUpdate, db: Session = Depends(get_db)):
    updated = crud.update_issue(db, issue_id, issue_data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    return updated

@app.post("/issues/{issue_id}/acknowledge", response_model=schemas.IssueOut)
@app.post("/api/issues/{issue_id}/acknowledge", response_model=schemas.IssueOut)
def acknowledge_issue_endpoint(issue_id: int, db: Session = Depends(get_db)):
    acknowledged = crud.acknowledge_issue(db, issue_id)
    if not acknowledged:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    return acknowledged

@app.post("/issues/{issue_id}/resolve", response_model=schemas.IssueOut)
@app.post("/api/issues/{issue_id}/resolve", response_model=schemas.IssueOut)
def resolve_issue_endpoint(issue_id: int, db: Session = Depends(get_db)):
    resolved = crud.resolve_issue(db, issue_id)
    if not resolved:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    return resolved

# --- Announcements Endpoints ---
@app.get("/announcements", response_model=List[schemas.AnnouncementOut])
@app.get("/api/announcements", response_model=List[schemas.AnnouncementOut])
def read_all_announcements(
    event_id: Optional[int] = Query(None),
    target_type: Optional[str] = Query(None),
    volunteer_id: Optional[int] = Query(None, description="Only announcements this volunteer should see (EVERYONE, VOLUNTEERS, their zones/roles)"),
    db: Session = Depends(get_db)
):
    return crud.get_announcements(db, event_id=event_id, target_type=target_type, volunteer_id=volunteer_id)

@app.get("/api/events/{event_id}/announcements", response_model=List[schemas.AnnouncementOut])
@app.get("/events/{event_id}/announcements", response_model=List[schemas.AnnouncementOut])
def read_announcements(event_id: int, db: Session = Depends(get_db)):
    return crud.get_announcements_by_event(db, event_id)

@app.post("/announcements", response_model=schemas.AnnouncementOut, status_code=status.HTTP_201_CREATED)
@app.post("/api/announcements", response_model=schemas.AnnouncementOut, status_code=status.HTTP_201_CREATED)
def broadcast_announcement(ann: schemas.AnnouncementCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_announcement(db, ann)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Escalations Endpoints (Legacy & crowd incident support) ---
@app.get("/api/events/{event_id}/escalations", response_model=List[schemas.EscalationOut])
@app.get("/events/{event_id}/escalations", response_model=List[schemas.EscalationOut])
def read_escalations(event_id: int, db: Session = Depends(get_db)):
    return crud.get_escalations_by_event(db, event_id)

@app.post("/escalations", response_model=schemas.EscalationOut, status_code=status.HTTP_201_CREATED)
@app.post("/api/escalations", response_model=schemas.EscalationOut, status_code=status.HTTP_201_CREATED)
def report_escalation(esc: schemas.EscalationCreate, db: Session = Depends(get_db)):
    return crud.create_escalation(db, esc)

@app.put("/escalations/{esc_id}", response_model=schemas.EscalationOut)
@app.put("/api/escalations/{esc_id}", response_model=schemas.EscalationOut)
def update_escalation_status(esc_id: int, data: schemas.EscalationUpdate, db: Session = Depends(get_db)):
    updated = crud.update_escalation(db, esc_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Escalation not found")
    return updated


# ----------------- 6. COORDINATION DASHBOARD -----------------
@app.get("/dashboard/metrics", response_model=schemas.DashboardMetrics)
@app.get("/api/dashboard/metrics", response_model=schemas.DashboardMetrics)
def get_dashboard(event_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    return crud.get_dashboard_metrics(db, event_id)

@app.post("/api/seed")
@app.post("/seed")
def seed_demo_data(force: bool = Query(False), db: Session = Depends(get_db)):
    crud.seed_initial_data(db, force_reset=force)
    return {"message": "Demo data checked/seeded successfully"}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
