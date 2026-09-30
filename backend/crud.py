from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
import models, schemas
import assignment_engine

# --- Event CRUD ---
def get_events(db: Session):
    return db.query(models.Event).order_by(models.Event.id.desc()).all()

def get_event(db: Session, event_id: int):
    return db.query(models.Event).filter(models.Event.id == event_id).first()

def create_event(db: Session, event: schemas.EventCreate):
    db_event = models.Event(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

# --- Role CRUD ---
def get_roles_by_event(db: Session, event_id: int):
    return db.query(models.Role).filter(models.Role.event_id == event_id).all()

def create_role(db: Session, role: schemas.RoleCreate):
    db_role = models.Role(**role.model_dump())
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

# --- Volunteer CRUD ---
def format_volunteer_data(db_vol: models.Volunteer, include_history: bool = False):
    total_hours = db_vol.total_hours_worked

    assigned_shifts = [
        {
            "assignment_id": a.id,
            "shift_id": a.shift_id,
            "title": a.shift.title if a.shift else "Shift",
            "zone": a.shift.zone if a.shift else "General",
            "start_time": a.shift.start_time if a.shift else "",
            "end_time": a.shift.end_time if a.shift else "",
            "status": a.status
        }
        for a in (db_vol.shift_assignments or [])
        if a.status in ("Assigned", "Confirmed")
    ]

    contact = {
        "email": db_vol.email,
        "phone": db_vol.phone or "",
        "emergency_contact": db_vol.emergency_contact or ""
    }

    data = {
        "id": db_vol.id,
        "name": db_vol.full_name,
        "full_name": db_vol.full_name,
        "email": db_vol.email,
        "phone": db_vol.phone,
        "skills": db_vol.skills,
        "availability": "Available" if db_vol.status != "Checked Out" else "Checked Out",
        "preferences": db_vol.preferences or db_vol.notes or "General",
        "contact_details": contact,
        "emergency_contact": db_vol.emergency_contact,
        "notes": db_vol.notes,
        "current_status": db_vol.status,
        "status": db_vol.status,
        "total_hours_worked": total_hours,
        "current_assigned_shifts": assigned_shifts,
        "check_in_time": db_vol.check_in_time,
        "check_out_time": db_vol.check_out_time,
        "created_at": db_vol.created_at
    }

    if include_history:
        history = [
            {
                "id": r.id,
                "volunteer_id": r.volunteer_id,
                "check_in_time": r.check_in_time,
                "check_out_time": r.check_out_time,
                "hours_worked": r.hours_worked,
                "created_at": r.created_at
            }
            for r in sorted(db_vol.attendance_records or [], key=lambda x: x.id, reverse=True)
        ]
        data["attendance_history"] = history

    return data

def get_volunteers(db: Session, search: str = None, status: str = None):
    query = db.query(models.Volunteer)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (models.Volunteer.full_name.ilike(s)) |
            (models.Volunteer.skills.ilike(s)) |
            (models.Volunteer.email.ilike(s))
        )
    if status:
        query = query.filter(models.Volunteer.status == status)
    volunteers = query.order_by(models.Volunteer.id.desc()).all()
    return [format_volunteer_data(v) for v in volunteers]

def get_volunteer(db: Session, volunteer_id: int):
    return db.query(models.Volunteer).filter(models.Volunteer.id == volunteer_id).first()

def get_volunteer_detail(db: Session, volunteer_id: int):
    vol = get_volunteer(db, volunteer_id)
    if not vol:
        return None
    return format_volunteer_data(vol, include_history=True)

def create_volunteer(db: Session, volunteer: schemas.VolunteerCreate):
    db_vol = models.Volunteer(**volunteer.model_dump())
    db.add(db_vol)
    db.commit()
    db.refresh(db_vol)
    return format_volunteer_data(db_vol)

def update_volunteer(db: Session, volunteer_id: int, update_data: schemas.VolunteerUpdate):
    db_vol = get_volunteer(db, volunteer_id)
    if not db_vol:
        return None
    for key, val in update_data.model_dump(exclude_unset=True).items():
        setattr(db_vol, key, val)
    db.commit()
    db.refresh(db_vol)
    return format_volunteer_data(db_vol)

def check_in_volunteer(db: Session, volunteer_id: int):
    db_vol = get_volunteer(db, volunteer_id)
    if not db_vol:
        return None, "Volunteer not found"

    # Prevent duplicate active check-ins
    active_record = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.volunteer_id == volunteer_id,
        models.AttendanceRecord.check_out_time == None
    ).first()

    if db_vol.status == "Checked In" or active_record is not None:
        return None, f"Volunteer '{db_vol.full_name}' is already checked in"

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db_vol.status = "Checked In"
    db_vol.check_in_time = now_str

    record = models.AttendanceRecord(
        volunteer_id=db_vol.id,
        check_in_time=now_str,
        check_out_time=None,
        hours_worked=0.0
    )
    db.add(record)
    db.commit()
    db.refresh(db_vol)
    db.refresh(record)
    return db_vol, record

def check_out_volunteer(db: Session, volunteer_id: int):
    db_vol = get_volunteer(db, volunteer_id)
    if not db_vol:
        return None, None, "Volunteer not found"

    # Prevent checkout if the volunteer is not checked in
    if db_vol.status != "Checked In":
        return None, None, f"Volunteer '{db_vol.full_name}' is not currently checked in"

    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    # Find open attendance record
    record = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.volunteer_id == volunteer_id,
        models.AttendanceRecord.check_out_time == None
    ).order_by(models.AttendanceRecord.id.desc()).first()

    if not record:
        in_time = db_vol.check_in_time or now_str
        record = models.AttendanceRecord(
            volunteer_id=db_vol.id,
            check_in_time=in_time,
            check_out_time=None,
            hours_worked=0.0
        )
        db.add(record)
        db.flush()

    # Calculate hours worked for that attendance session
    try:
        in_dt = datetime.strptime(record.check_in_time, "%Y-%m-%d %H:%M:%S")
        delta_seconds = (now - in_dt).total_seconds()
        hours = round(max(0.01, delta_seconds / 3600.0), 2)
    except Exception:
        hours = 1.0

    record.check_out_time = now_str
    record.hours_worked = hours

    db_vol.status = "Checked Out"
    db_vol.check_out_time = now_str

    db.commit()
    db.refresh(db_vol)
    db.refresh(record)
    return db_vol, record, hours

# --- Shift & Assignment CRUD ---
def get_shifts_by_event(db: Session, event_id: int):
    shifts = db.query(models.Shift).filter(models.Shift.event_id == event_id).all()
    for s in shifts:
        s.coverage = assignment_engine.calculate_coverage(s)
    return shifts

def create_shift(db: Session, shift: schemas.ShiftCreate):
    db_shift = models.Shift(**shift.model_dump())
    db.add(db_shift)
    db.commit()
    db.refresh(db_shift)
    return db_shift

def assign_volunteer_to_shift(db: Session, shift_id: int, volunteer_id: int):
    # Check if assignment already exists
    existing = db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.shift_id == shift_id,
        models.ShiftAssignment.volunteer_id == volunteer_id
    ).first()
    if existing:
        return existing
    
    assignment = models.ShiftAssignment(
        shift_id=shift_id,
        volunteer_id=volunteer_id,
        status="Assigned"
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment

def remove_shift_assignment(db: Session, assignment_id: int):
    item = db.query(models.ShiftAssignment).filter(models.ShiftAssignment.id == assignment_id).first()
    if item:
        db.delete(item)
        db.commit()
        return True
    return False

def get_recommended_volunteers_for_shift(db: Session, shift_id: int):
    shift = db.query(models.Shift).filter(models.Shift.id == shift_id).first()
    if not shift:
        return []
    
    required_skill = (shift.required_skill or "").lower().strip()
    volunteers = db.query(models.Volunteer).all()
    
    assigned_vids = {a.volunteer_id for a in shift.assignments}
    
    scored_volunteers = []
    for v in volunteers:
        is_assigned = v.id in assigned_vids
        v_skills = [s.strip().lower() for s in (v.skills or "").split(",") if s.strip()]
        
        # Skill matching score
        match_score = 0
        matching_skills = []
        if required_skill:
            for skill in v_skills:
                if required_skill in skill or skill in required_skill:
                    match_score += 10
                    matching_skills.append(skill)
                elif any(word in skill for word in required_skill.split()):
                    match_score += 5
                    matching_skills.append(skill)
        else:
            match_score = 5  # No specific skill requirement

        # Bonus if checked in
        if v.status == "Checked In":
            match_score += 2

        scored_volunteers.append({
            "volunteer": v,
            "match_score": match_score,
            "is_assigned": is_assigned,
            "matching_skills": matching_skills,
            "is_checked_in": v.status == "Checked In"
        })
    
    # Sort by match_score desc, then checked in status
    scored_volunteers.sort(key=lambda x: (not x["is_assigned"], x["match_score"]), reverse=True)
    return scored_volunteers

# --- Task CRUD ---
def format_task(task: models.Task):
    if not task:
        return None
    # Normalize status: OPEN, IN_PROGRESS, RESOLVED
    status_raw = (task.status or "OPEN").upper().strip()
    if status_raw in ["TODO", "OPEN"]:
        normalized_status = "OPEN"
    elif status_raw in ["IN_PROGRESS", "IN PROGRESS", "PROGRESS"]:
        normalized_status = "IN_PROGRESS"
    elif status_raw in ["DONE", "RESOLVED", "COMPLETED"]:
        normalized_status = "RESOLVED"
    else:
        normalized_status = "OPEN"

    # Normalize priority: LOW, MEDIUM, HIGH, CRITICAL
    p_raw = (task.priority or "MEDIUM").upper().strip()
    if p_raw in ["URGENT", "CRITICAL"]:
        normalized_priority = "CRITICAL"
    elif p_raw in ["HIGH"]:
        normalized_priority = "HIGH"
    elif p_raw in ["LOW"]:
        normalized_priority = "LOW"
    else:
        normalized_priority = "MEDIUM"

    c_time = task.created_at.strftime("%Y-%m-%d %H:%M:%S") if task.created_at else None
    u_time = task.updated_at.strftime("%Y-%m-%d %H:%M:%S") if task.updated_at else c_time

    assigned_vol = None
    if task.assigned_volunteer:
        assigned_vol = format_volunteer_data(task.assigned_volunteer)

    return {
        "id": task.id,
        "event_id": task.event_id,
        "title": task.title,
        "description": task.description or "",
        "zone": task.zone or "General",
        "priority": normalized_priority,
        "status": normalized_status,
        "assigned_volunteer_id": task.assigned_volunteer_id,
        "assigned_volunteer": assigned_vol,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "created_time": c_time,
        "updated_time": u_time,
    }

def get_tasks(db: Session, event_id: int = None, zone: str = None):
    query = db.query(models.Task)
    if event_id:
        query = query.filter(models.Task.event_id == event_id)
    if zone and zone != "All Zones":
        query = query.filter(models.Task.zone == zone)
    tasks = query.order_by(models.Task.id.desc()).all()
    return [format_task(t) for t in tasks]

def get_tasks_by_event(db: Session, event_id: int, zone: str = None):
    return get_tasks(db, event_id=event_id, zone=zone)

def create_task(db: Session, task: schemas.TaskCreate):
    # 1. Validate assigned volunteer exists if ID is provided
    if task.assigned_volunteer_id:
        vol = db.query(models.Volunteer).filter(models.Volunteer.id == task.assigned_volunteer_id).first()
        if not vol:
            raise ValueError(f"Assigned volunteer with ID {task.assigned_volunteer_id} not found")

    # 2. Resolve event_id if not provided
    target_event_id = task.event_id
    if not target_event_id:
        active_evt = db.query(models.Event).first()
        target_event_id = active_evt.id if active_evt else 1

    # 3. Normalize priority
    p_raw = (task.priority or "MEDIUM").upper().strip()
    if p_raw in ["URGENT", "CRITICAL"]:
        priority = "CRITICAL"
    elif p_raw in ["HIGH", "LOW"]:
        priority = p_raw
    else:
        priority = "MEDIUM"

    # 4. Normalize status (Default OPEN)
    s_raw = (task.status or "OPEN").upper().strip()
    if s_raw in ["IN_PROGRESS", "IN PROGRESS"]:
        status = "IN_PROGRESS"
    elif s_raw in ["RESOLVED", "DONE"]:
        status = "RESOLVED"
    else:
        status = "OPEN"

    now = datetime.utcnow()
    db_task = models.Task(
        event_id=target_event_id,
        title=task.title,
        description=task.description or "",
        zone=task.zone or "General",
        priority=priority,
        status=status,
        assigned_volunteer_id=task.assigned_volunteer_id,
        created_at=now,
        updated_at=now
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return format_task(db_task)

def update_task(db: Session, task_id: int, update_data: schemas.TaskUpdate):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        return None

    data = update_data.model_dump(exclude_unset=True)

    # Validate assigned_volunteer_id if present in update
    if "assigned_volunteer_id" in data:
        vid = data["assigned_volunteer_id"]
        if vid is not None and vid > 0:
            vol = db.query(models.Volunteer).filter(models.Volunteer.id == vid).first()
            if not vol:
                raise ValueError(f"Assigned volunteer with ID {vid} not found")
            db_task.assigned_volunteer_id = vid
        else:
            db_task.assigned_volunteer_id = None

    # Status update & normalization
    if "status" in data and data["status"] is not None:
        s_raw = str(data["status"]).upper().strip()
        if s_raw in ["IN_PROGRESS", "IN PROGRESS"]:
            db_task.status = "IN_PROGRESS"
        elif s_raw in ["RESOLVED", "DONE"]:
            db_task.status = "RESOLVED"
        elif s_raw in ["OPEN", "TODO"]:
            db_task.status = "OPEN"
        else:
            raise ValueError(f"Invalid status '{data['status']}'. Allowed: OPEN, IN_PROGRESS, RESOLVED")

    # Priority update & normalization
    if "priority" in data and data["priority"] is not None:
        p_raw = str(data["priority"]).upper().strip()
        if p_raw in ["URGENT", "CRITICAL"]:
            db_task.priority = "CRITICAL"
        elif p_raw in ["HIGH", "LOW"]:
            db_task.priority = p_raw
        elif p_raw in ["MEDIUM"]:
            db_task.priority = "MEDIUM"
        else:
            raise ValueError(f"Invalid priority '{data['priority']}'. Allowed: LOW, MEDIUM, HIGH, CRITICAL")

    if "title" in data and data["title"] is not None:
        db_task.title = data["title"]
    if "description" in data and data["description"] is not None:
        db_task.description = data["description"]
    if "zone" in data and data["zone"] is not None:
        db_task.zone = data["zone"]

    db_task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_task)
    return format_task(db_task)

def delete_task(db: Session, task_id: int):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        db.delete(db_task)
        db.commit()
        return True
    return False

# --- Coordinator Routing Rule ---
def route_issue_coordinator(issue_type: str) -> str:
    mapping = {
        "MEDICAL": "First Aid Coordinator",
        "CROWD_SURGE": "Security Coordinator",
        "SECURITY": "Security Coordinator",
        "MISSING_EQUIPMENT": "Operations Coordinator",
        "OTHER": "Event Coordinator",
    }
    return mapping.get(str(issue_type).strip().upper(), "Event Coordinator")

# --- Issue CRUD ---
def get_issues(
    db: Session,
    event_id: Optional[int] = None,
    status: Optional[str] = None,
    issue_type: Optional[str] = None,
    zone: Optional[str] = None,
    priority: Optional[str] = None
):
    query = db.query(models.Issue)
    if event_id is not None:
        query = query.filter(models.Issue.event_id == event_id)
    if status:
        query = query.filter(models.Issue.status == status.upper())
    if issue_type:
        query = query.filter(models.Issue.issue_type == issue_type.upper())
    if zone:
        query = query.filter(models.Issue.zone == zone)
    if priority:
        query = query.filter(models.Issue.priority == priority.upper())
    return query.order_by(models.Issue.id.desc()).all()

def get_issue(db: Session, issue_id: int):
    return db.query(models.Issue).filter(models.Issue.id == issue_id).first()

def create_issue(db: Session, issue: schemas.IssueCreate):
    norm_type = str(issue.issue_type).strip().upper()
    norm_priority = str(issue.priority or "MEDIUM").strip().upper()
    norm_status = str(issue.status or "OPEN").strip().upper()

    coordinator = issue.assigned_coordinator
    if not coordinator or not coordinator.strip():
        coordinator = route_issue_coordinator(norm_type)

    event_id = issue.event_id
    if event_id is None:
        ev = db.query(models.Event).first()
        if ev:
            event_id = ev.id

    db_issue = models.Issue(
        event_id=event_id,
        title=issue.title,
        description=issue.description or "",
        zone=issue.zone or "General",
        issue_type=norm_type,
        priority=norm_priority,
        status=norm_status,
        assigned_coordinator=coordinator,
        created_at=datetime.utcnow()
    )
    db.add(db_issue)
    db.commit()
    db.refresh(db_issue)
    return db_issue

def update_issue(db: Session, issue_id: int, issue_data: schemas.IssueUpdate):
    db_issue = db.query(models.Issue).filter(models.Issue.id == issue_id).first()
    if not db_issue:
        return None
    data = issue_data.model_dump(exclude_unset=True)
    if "status" in data and data["status"]:
        new_status = str(data["status"]).strip().upper()
        data["status"] = new_status
        if new_status == "RESOLVED" and not db_issue.resolved_at:
            db_issue.resolved_at = datetime.utcnow()
        elif new_status == "ACKNOWLEDGED" and not db_issue.acknowledged_at:
            db_issue.acknowledged_at = datetime.utcnow()
    if "priority" in data and data["priority"]:
        data["priority"] = str(data["priority"]).strip().upper()
    if "issue_type" in data and data["issue_type"]:
        new_type = str(data["issue_type"]).strip().upper()
        data["issue_type"] = new_type
        if "assigned_coordinator" not in data or not data["assigned_coordinator"]:
            data["assigned_coordinator"] = route_issue_coordinator(new_type)

    for key, val in data.items():
        setattr(db_issue, key, val)
    db.commit()
    db.refresh(db_issue)
    return db_issue

def acknowledge_issue(db: Session, issue_id: int):
    db_issue = db.query(models.Issue).filter(models.Issue.id == issue_id).first()
    if not db_issue:
        return None
    db_issue.status = "ACKNOWLEDGED"
    db_issue.acknowledged_at = datetime.utcnow()
    db.commit()
    db.refresh(db_issue)
    return db_issue

def resolve_issue(db: Session, issue_id: int):
    db_issue = db.query(models.Issue).filter(models.Issue.id == issue_id).first()
    if not db_issue:
        return None
    db_issue.status = "RESOLVED"
    db_issue.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(db_issue)
    return db_issue

# --- Announcement CRUD ---
def get_announcements(db: Session, event_id: Optional[int] = None, target_type: Optional[str] = None):
    query = db.query(models.Announcement)
    if event_id is not None:
        query = query.filter(models.Announcement.event_id == event_id)
    if target_type:
        query = query.filter(models.Announcement.target_type == target_type.upper())
    return query.order_by(models.Announcement.id.desc()).all()

def get_announcements_by_event(db: Session, event_id: int):
    return db.query(models.Announcement).filter(
        models.Announcement.event_id == event_id
    ).order_by(models.Announcement.id.desc()).all()

def create_announcement(db: Session, ann: schemas.AnnouncementCreate):
    data = ann.model_dump()
    msg = data.get("message") or ""
    cnt = data.get("content") or ""
    if not cnt and msg:
        cnt = msg
    if not msg and cnt:
        msg = cnt
    data["content"] = cnt
    data["message"] = msg
    if not data.get("target_type"):
        data["target_type"] = "EVERYONE"
    else:
        data["target_type"] = str(data["target_type"]).upper()

    if data.get("event_id") is None:
        ev = db.query(models.Event).first()
        if ev:
            data["event_id"] = ev.id

    db_ann = models.Announcement(**data)
    db.add(db_ann)
    db.commit()
    db.refresh(db_ann)
    return db_ann

# --- Escalation CRUD ---
def get_escalations_by_event(db: Session, event_id: int):
    return db.query(models.Escalation).filter(
        models.Escalation.event_id == event_id
    ).order_by(models.Escalation.id.desc()).all()

def create_escalation(db: Session, esc: schemas.EscalationCreate):
    db_esc = models.Escalation(**esc.model_dump())
    db.add(db_esc)
    db.commit()
    db.refresh(db_esc)
    return db_esc

def update_escalation(db: Session, esc_id: int, update_data: schemas.EscalationUpdate):
    db_esc = db.query(models.Escalation).filter(models.Escalation.id == esc_id).first()
    if not db_esc:
        return None
    data = update_data.model_dump(exclude_unset=True)
    if "status" in data and data["status"] == "Resolved" and not db_esc.resolved_at:
        db_esc.resolved_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for key, val in data.items():
        setattr(db_esc, key, val)
    db.commit()
    db.refresh(db_esc)
    return db_esc

# --- Dashboard Overview ---
def get_dashboard_metrics(db: Session, event_id: int = None):
    events = db.query(models.Event).all()
    active_event = None
    if event_id:
        active_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not active_event and events:
        active_event = events[0]
    
    current_event_id = active_event.id if active_event else None
    current_event_name = active_event.name if active_event else "No Event"

    volunteers = db.query(models.Volunteer).all()
    total_volunteers = len(volunteers)
    checked_in = sum(1 for v in volunteers if v.status == "Checked In")
    checked_out = sum(1 for v in volunteers if v.status == "Checked Out")
    registered = sum(1 for v in volunteers if v.status == "Registered")
    available_volunteers = sum(1 for v in volunteers if v.status != "Checked Out")
    total_volunteer_hours = round(sum(v.total_hours_worked for v in volunteers), 2)

    shifts = db.query(models.Shift).filter(models.Shift.event_id == current_event_id).all() if current_event_id else []
    total_shifts = len(shifts)
    filled_shifts = sum(1 for s in shifts if len(s.assignments) >= s.capacity)

    tasks = db.query(models.Task).filter(models.Task.event_id == current_event_id).all() if current_event_id else []
    total_tasks = len(tasks)
    open_tasks = sum(1 for t in tasks if str(t.status).upper() in ["OPEN", "TODO"])
    in_progress_tasks = sum(1 for t in tasks if str(t.status).upper() in ["IN_PROGRESS", "IN PROGRESS"])
    resolved_tasks = sum(1 for t in tasks if str(t.status).upper() in ["RESOLVED", "DONE"])
    critical_high_open_tasks = sum(1 for t in tasks if str(t.status).upper() in ["OPEN", "TODO"] and str(t.priority).upper() in ["CRITICAL", "URGENT", "HIGH"])

    # Issues metrics (Phase 5)
    all_issues = db.query(models.Issue).filter(models.Issue.event_id == current_event_id).all() if current_event_id else db.query(models.Issue).all()
    open_issues = sum(1 for i in all_issues if str(i.status).upper() == "OPEN")
    critical_issues = sum(1 for i in all_issues if str(i.status).upper() == "OPEN" and str(i.priority).upper() == "CRITICAL")
    high_priority_issues = sum(1 for i in all_issues if str(i.status).upper() == "OPEN" and str(i.priority).upper() == "HIGH")

    urgent_issues_list = [
        {
            "id": i.id,
            "event_id": i.event_id,
            "title": i.title,
            "description": i.description,
            "zone": i.zone,
            "issue_type": i.issue_type,
            "priority": i.priority,
            "status": i.status,
            "assigned_coordinator": i.assigned_coordinator,
            "created_at": i.created_at.isoformat() if i.created_at else None,
            "is_urgent": True,
            "requires_attention": True
        }
        for i in all_issues
        if str(i.status).upper() == "OPEN" and str(i.priority).upper() in ["CRITICAL", "HIGH"]
    ]

    escalations = db.query(models.Escalation).filter(models.Escalation.event_id == current_event_id).all() if current_event_id else []
    active_escalations = sum(1 for e in escalations if e.status != "Resolved")
    critical_escalations = sum(1 for e in escalations if e.severity == "Critical" and e.status != "Resolved")

    # Zone summary
    zones = ["Main Stage", "North Gate", "South Exit", "Medical Tent", "Food Court", "VIP Lounge", "General"]
    zone_data = []
    for z in zones:
        zone_tasks = sum(1 for t in tasks if t.zone == z)
        zone_incidents = sum(1 for e in escalations if e.zone == z and e.status != "Resolved")
        zone_issues = sum(1 for i in all_issues if i.zone == z and str(i.status).upper() != "RESOLVED")
        zone_volunteers = sum(1 for s in shifts if s.zone == z for _ in s.assignments)

        # calculate crowd density status indicator
        status_flag = "Normal"
        if zone_incidents > 0 or zone_issues > 0 or zone_tasks > 3:
            status_flag = "Attention Needed"
        if any(e.severity == "Critical" and e.status != "Resolved" for e in escalations if e.zone == z) or \
           any(str(i.priority).upper() == "CRITICAL" and str(i.status).upper() != "RESOLVED" for i in all_issues if i.zone == z):
            status_flag = "Critical Surge"

        zone_data.append({
            "zone": z,
            "active_tasks": zone_tasks,
            "open_incidents": zone_incidents + zone_issues,
            "assigned_staff": zone_volunteers,
            "status": status_flag
        })

    return {
        "total_events": len(events),
        "active_event_id": current_event_id,
        "active_event_name": current_event_name,
        "total_volunteers": total_volunteers,
        "checked_in_volunteers": checked_in,
        "present_volunteers": checked_in,
        "checked_out_volunteers": checked_out,
        "registered_volunteers": registered,
        "available_volunteers": available_volunteers,
        "total_volunteer_hours": total_volunteer_hours,
        "total_shifts": total_shifts,
        "filled_shifts": filled_shifts,
        "total_tasks": total_tasks,
        "open_tasks": open_tasks,
        "pending_tasks": open_tasks,
        "in_progress_tasks": in_progress_tasks,
        "tasks_in_progress": in_progress_tasks,
        "resolved_tasks": resolved_tasks,
        "done_tasks": resolved_tasks,
        "critical_high_open_tasks": critical_high_open_tasks,
        "open_issues": open_issues,
        "critical_issues": critical_issues,
        "high_priority_issues": high_priority_issues,
        "urgent_issues": urgent_issues_list,
        "active_escalations": active_escalations,
        "critical_escalations": critical_escalations,
        "zones_crowd_summary": zone_data
    }

# --- Database Seeder ---
def seed_initial_data(db: Session):
    # Seed attendance records for existing database volunteers if table is empty
    if db.query(models.AttendanceRecord).count() == 0:
        for v in db.query(models.Volunteer).all():
            if v.status == "Checked In":
                db.add(models.AttendanceRecord(
                    volunteer_id=v.id,
                    check_in_time=v.check_in_time or "2026-10-01 08:30:00",
                    check_out_time=None,
                    hours_worked=0.0
                ))
            elif v.status == "Checked Out":
                db.add(models.AttendanceRecord(
                    volunteer_id=v.id,
                    check_in_time=v.check_in_time or "2026-10-01 08:30:00",
                    check_out_time=v.check_out_time or "2026-10-01 13:00:00",
                    hours_worked=4.5
                ))
        db.commit()

    # Only seed if no events exist
    if db.query(models.Event).count() > 0:
        return

    # 1. Create Hackathon / Mega Event
    event1 = models.Event(
        name="Global Tech Summit & Music Festival 2026",
        description="Massive 3-day outdoor innovation summit and evening concert series with 15,000+ attendees.",
        location="Silicon Bay Arena & Waterfront Grounds",
        start_date="2026-10-02 08:00",
        end_date="2026-10-04 23:00",
        status="Active"
    )
    db.add(event1)
    db.commit()
    db.refresh(event1)

    # 2. Roles
    roles_data = [
        ("Crowd Safety & Flow Marshal", "Direct crowd influx, manage queue lines at gates and stages", "Crowd Control", 12),
        ("Medical & First Aid Responder", "Assist injured guests, coordinate with EMTs, staff medical tents", "First Aid", 6),
        ("Registration & Badge Coordinator", "Scan attendee QR codes, hand out RFID badges, manage inquiries", "Customer Service", 10),
        ("VIP & Speaker Escort", "Accompany keynote speakers, manage backstage passes and green room", "VIP Handling", 4),
        ("Logistics & Hydration Station", "Distribute bottled water, restock medical packs and stage supplies", "Logistics", 8)
    ]
    created_roles = []
    for name, desc, skill, count in roles_data:
        r = models.Role(event_id=event1.id, name=name, description=desc, required_skill=skill, needed_count=count)
        db.add(r)
        created_roles.append(r)
    db.commit()

    # 3. Volunteers
    volunteers_data = [
        ("Priya Sharma", "priya.sharma@example.com", "+1-555-0101", "First Aid, CPR Certified, Emergency Triage", "Checked In", "Uncle: +1-555-9001"),
        ("Alex Chen", "alex.chen@example.com", "+1-555-0102", "Crowd Control, De-escalation, Radio Comms", "Checked In", "Sister: +1-555-9002"),
        ("Marcus Vance", "marcus.v@example.com", "+1-555-0103", "Customer Service, Bilingual (Spanish), Registration", "Checked In", "Mother: +1-555-9003"),
        ("Elena Rostova", "elena.r@example.com", "+1-555-0104", "VIP Handling, Hospitality, Event Operations", "Registered", "Friend: +1-555-9004"),
        ("David Kim", "david.kim@example.com", "+1-555-0105", "Logistics, Forklift License, Heavy Lifting", "Checked In", "Father: +1-555-9005"),
        ("Sarah Jenkins", "sarah.j@example.com", "+1-555-0106", "First Aid, AED Certified, Nursing Student", "Registered", "Partner: +1-555-9006"),
        ("Jamal Washington", "jamal.w@example.com", "+1-555-0107", "Crowd Control, Security Awareness, Conflict Resolution", "Checked In", "Brother: +1-555-9007"),
        ("Aisha Patel", "aisha.patel@example.com", "+1-555-0108", "Customer Service, Public Speaking, Info Desk", "Checked Out", "Aunt: +1-555-9008"),
        ("Liam O'Connor", "liam.oc@example.com", "+1-555-0109", "Logistics, Stage Tech, Radio Comms", "Registered", "Mother: +1-555-9009"),
        ("Zoe Martinez", "zoe.m@example.com", "+1-555-0110", "Crowd Control, Event Ushering, First Aid", "Checked In", "Brother: +1-555-9010"),
    ]
    created_vols = []
    for name, email, phone, skills, status, em in volunteers_data:
        v = models.Volunteer(
            full_name=name, email=email, phone=phone, skills=skills,
            status=status, emergency_contact=em,
            check_in_time="2026-10-01 08:30:00" if status == "Checked In" else None,
            check_out_time="2026-10-01 13:00:00" if status == "Checked Out" else None
        )
        db.add(v)
        created_vols.append(v)
    db.commit()

    # 4. Shifts
    shifts_data = [
        ("Morning Gate Surge - North Entrance", "08:00", "12:00", "North Gate", "Crowd Control", 3, created_roles[0].id),
        ("Main Stage Soundcheck & Perimeters", "10:00", "14:00", "Main Stage", "Crowd Control", 2, created_roles[0].id),
        ("Medical Response Unit - North Field", "09:00", "15:00", "Medical Tent", "First Aid", 2, created_roles[1].id),
        ("VIP Welcome Lounge & Speaker Escort", "11:00", "16:00", "VIP Lounge", "VIP Handling", 2, created_roles[3].id),
        ("Attendee RFID Badge Check-In Desk", "08:00", "13:00", "Registration", "Customer Service", 3, created_roles[2].id),
        ("Hydration & Water Pack Distribution", "12:00", "17:00", "Food Court", "Logistics", 2, created_roles[4].id),
    ]
    created_shifts = []
    for title, st, et, zone, skill, cap, role_id in shifts_data:
        s = models.Shift(
            event_id=event1.id, role_id=role_id, title=title,
            start_time=st, end_time=et, zone=zone,
            required_skill=skill, capacity=cap
        )
        db.add(s)
        created_shifts.append(s)
    db.commit()

    # 5. Shift Assignments
    assignments = [
        (created_shifts[0].id, created_vols[1].id), # Alex Chen -> Morning Gate Surge
        (created_shifts[0].id, created_vols[6].id), # Jamal -> Morning Gate Surge
        (created_shifts[2].id, created_vols[0].id), # Priya -> Medical Tent
        (created_shifts[4].id, created_vols[2].id), # Marcus -> Registration Desk
        (created_shifts[5].id, created_vols[4].id), # David Kim -> Hydration Logistics
    ]
    for sid, vid in assignments:
        sa = models.ShiftAssignment(shift_id=sid, volunteer_id=vid, status="Assigned")
        db.add(sa)
    db.commit()

    # 6. Tasks (Kanban)
    tasks_data = [
        ("Inspect barricades at Gate 3", "Ensure emergency latch release is operational and signs are visible", "North Gate", "HIGH", "IN_PROGRESS", created_vols[1].id),
        ("Deploy 20 extra water cases to Medical Tent", "Crowd volume increased by 30% under direct sun", "Medical Tent", "CRITICAL", "OPEN", created_vols[4].id),
        ("Calibrate badge RFID scanners at Gate 1", "3 scanners reported slow NFC sync during testing", "Registration", "MEDIUM", "RESOLVED", created_vols[2].id),
        ("Direct overflow crowd toward South Concourse", "Prevent bottleneck around merchandise kiosks", "Main Stage", "CRITICAL", "IN_PROGRESS", created_vols[6].id),
        ("Restock first-aid ice packs and electrolytes", "Coordinate with main ambulance supply liaison", "Medical Tent", "HIGH", "OPEN", created_vols[0].id),
        ("Escort keynote panel speakers to Green Room B", "Check badges and supply briefing dossiers", "VIP Lounge", "LOW", "RESOLVED", None),
    ]
    for title, desc, zone, priority, status, vid in tasks_data:
        t = models.Task(
            event_id=event1.id, title=title, description=desc, zone=zone,
            priority=priority, status=status, assigned_volunteer_id=vid
        )
        db.add(t)
    db.commit()

    # 7. Announcements
    announcements_data = [
        ("Welcome Volunteers & Shift Briefing", "Welcome team! Please confirm your zones via the radio channel 4. Water and lunch tokens are at Booth 12.", "General", "Operations Lead"),
        ("Weather Advisory: Afternoon Heat Index", "Temps expected to peak at 32°C. Hydration station volunteers should actively encourage attendees to drink water.", "High", "Safety Coordinator"),
        ("Gate 2 Access Point Relocated", "Gate 2 turnstiles temporarily re-routed to West corridor due to construction equipment.", "Critical Alert", "Crowd Marshal"),
    ]
    for title, content, priority, author in announcements_data:
        a = models.Announcement(event_id=event1.id, title=title, content=content, priority=priority, author=author)
        db.add(a)
    db.commit()

    # 8. Escalations (Incidents)
    escalations_data = [
        ("North Gate", "Crowd Bottleneck at Bag Check Lane 4", "Attendees pushing near security barrier due to one scanner glitch. Need 2 additional crowd flow volunteers.", "High", "In Review", "Alex Chen (Marshal)"),
        ("Main Stage", "Dehydrated Attendee in Front Row", "Female attendee experiencing lightheadedness. First responder Priya Sharma already on site administering electrolytes.", "Medium", "Open", "Stage Usher"),
        ("South Exit", "Exit Gate 5 Signage Obstructed", "Temporary vendor banner was covering the Emergency Exit signage. Maintenance team notified.", "Low", "Resolved", "Safety Officer"),
    ]
    for zone, title, desc, sev, status, rep in escalations_data:
        e = models.Escalation(
            event_id=event1.id, zone=zone, title=title, description=desc,
            severity=sev, status=status, reported_by=rep,
            resolved_at="2026-10-01 10:15:00" if status == "Resolved" else None
        )
        db.add(e)
    db.commit()

    # 9. Issues (Phase 5 System)
    if db.query(models.Issue).count() == 0:
        issues_data = [
            ("Suspected Heat Stroke at Front Stage Barrier", "Attendee collapsed near front barricade. EMT requested immediately.", "Main Stage", "MEDICAL", "CRITICAL", "OPEN", "First Aid Coordinator"),
            ("Crowd Surge at Gate 3 Turnstiles", "Over 200 attendees pressing through narrow queue line. Barricade bowing.", "North Gate", "CROWD_SURGE", "HIGH", "OPEN", "Security Coordinator"),
            ("Missing UHF Two-Way Radios Box #4", "Box of 6 radios and battery chargers not found in logistics storage.", "Food Court", "MISSING_EQUIPMENT", "MEDIUM", "OPEN", "Operations Coordinator"),
            ("Unauthorized Backstage Access Attempt", "Individual without RFID wristband attempted VIP lounge perimeter entry.", "VIP Lounge", "SECURITY", "HIGH", "ACKNOWLEDGED", "Security Coordinator"),
            ("Signage fallen near Restroom B", "Directional sign detached from stanchion.", "General", "OTHER", "LOW", "RESOLVED", "Event Coordinator"),
        ]
        for title, desc, zone, itype, prio, st, coord in issues_data:
            iss = models.Issue(
                event_id=event1.id,
                title=title,
                description=desc,
                zone=zone,
                issue_type=itype,
                priority=prio,
                status=st,
                assigned_coordinator=coord,
                acknowledged_at=datetime.utcnow() if st in ["ACKNOWLEDGED", "RESOLVED"] else None,
                resolved_at=datetime.utcnow() if st == "RESOLVED" else None,
                created_at=datetime.utcnow()
            )
            db.add(iss)
        db.commit()
