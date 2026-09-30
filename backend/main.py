from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db, init_db
import models, schemas, crud
import assignment_engine

# Initialize database tables and run lightweight migrations
init_db()

app = FastAPI(
    title="Event Volunteer & Crowd Coordination Platform API",
    description="Hackathon backend for Event Volunteer & Crowd Coordination Platform",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup hook to automatically seed mock data if database is empty
@app.on_event("startup")
def on_startup():
    db = next(get_db())
    crud.seed_initial_data(db)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Event Volunteer & Crowd Coordination API",
        "docs_url": "/docs"
    }

# ----------------- 1. EVENT & ROLE SETUP -----------------
@app.get("/api/events", response_model=List[schemas.EventOut])
def read_events(db: Session = Depends(get_db)):
    return crud.get_events(db)

@app.get("/api/events/{event_id}", response_model=schemas.EventOut)
def read_event(event_id: int, db: Session = Depends(get_db)):
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@app.post("/api/events", response_model=schemas.EventOut, status_code=status.HTTP_201_CREATED)
def create_new_event(event: schemas.EventCreate, db: Session = Depends(get_db)):
    return crud.create_event(db, event)

@app.get("/api/events/{event_id}/roles", response_model=List[schemas.RoleOut])
def read_roles(event_id: int, db: Session = Depends(get_db)):
    return crud.get_roles_by_event(db, event_id)

@app.post("/api/roles", response_model=schemas.RoleOut, status_code=status.HTTP_201_CREATED)
def create_new_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    return crud.create_role(db, role)


# ----------------- 2. VOLUNTEER PROFILES & ATTENDANCE TRACKING -----------------
@app.get("/volunteers", response_model=List[schemas.VolunteerOut])
@app.get("/api/volunteers", response_model=List[schemas.VolunteerOut])
def read_volunteers(
    search: Optional[str] = Query(None, description="Search by name, skills or email"),
    status: Optional[str] = Query(None, description="Filter by status: Registered, Checked In, Checked Out"),
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
    assignment = crud.assign_volunteer_to_shift(db, req.shift_id, req.volunteer_id)
    shift = db.query(models.Shift).filter(models.Shift.id == req.shift_id).first()
    cov = assignment_engine.calculate_coverage(shift) if shift else None
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
    db: Session = Depends(get_db)
):
    """Return current active shift assignments."""
    query = db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.status.in_(["Assigned", "Confirmed"])
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
            "zone": a.shift.zone if a.shift else "General",
            "volunteer_id": a.volunteer_id,
            "volunteer_name": a.volunteer.full_name if a.volunteer else "Unknown Volunteer",
            "volunteer_skills": a.volunteer.skills if a.volunteer else "",
            "volunteer_status": a.volunteer.status if a.volunteer else "",
            "status": a.status,
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
    result = assignment_engine.apply_single_rebalance(
        db,
        volunteer_id=req.volunteer_id,
        from_shift_id=req.from_shift_id,
        to_shift_id=req.to_shift_id
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


# ----------------- 4. LIVE TASK BOARD -----------------
@app.get("/tasks", response_model=List[schemas.TaskOut])
@app.get("/api/tasks", response_model=List[schemas.TaskOut])
def read_all_tasks(
    event_id: Optional[int] = Query(None),
    zone: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieve tasks with volunteer details, zone, priority, status, and timestamps."""
    return crud.get_tasks(db, event_id=event_id, zone=zone)

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
        return crud.create_task(db, task)
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

@app.put("/tasks/{task_id}", response_model=schemas.TaskOut)
@app.put("/api/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task_details(task_id: int, task_data: schemas.TaskUpdate, db: Session = Depends(get_db)):
    try:
        updated = crud.update_task(db, task_id, task_data)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return updated
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

@app.delete("/tasks/{task_id}")
@app.delete("/api/tasks/{task_id}")
def delete_task_item(task_id: int, db: Session = Depends(get_db)):
    if not crud.delete_task(db, task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return {"message": "Task deleted successfully"}


# ----------------- 5. INCIDENTS, ISSUES & ANNOUNCEMENTS -----------------
# --- Issues Endpoints ---
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
    return crud.create_issue(db, issue)

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
    db: Session = Depends(get_db)
):
    return crud.get_announcements(db, event_id=event_id, target_type=target_type)

@app.get("/api/events/{event_id}/announcements", response_model=List[schemas.AnnouncementOut])
@app.get("/events/{event_id}/announcements", response_model=List[schemas.AnnouncementOut])
def read_announcements(event_id: int, db: Session = Depends(get_db)):
    return crud.get_announcements_by_event(db, event_id)

@app.post("/announcements", response_model=schemas.AnnouncementOut, status_code=status.HTTP_201_CREATED)
@app.post("/api/announcements", response_model=schemas.AnnouncementOut, status_code=status.HTTP_201_CREATED)
def broadcast_announcement(ann: schemas.AnnouncementCreate, db: Session = Depends(get_db)):
    return crud.create_announcement(db, ann)

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
def seed_demo_data(db: Session = Depends(get_db)):
    crud.seed_initial_data(db)
    return {"message": "Demo data checked/seeded successfully"}
