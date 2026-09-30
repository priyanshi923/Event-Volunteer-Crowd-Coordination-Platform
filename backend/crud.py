from datetime import datetime
from sqlalchemy.orm import Session
import models, schemas

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
    return query.order_by(models.Volunteer.id.desc()).all()

def get_volunteer(db: Session, volunteer_id: int):
    return db.query(models.Volunteer).filter(models.Volunteer.id == volunteer_id).first()

def create_volunteer(db: Session, volunteer: schemas.VolunteerCreate):
    db_vol = models.Volunteer(**volunteer.model_dump())
    db.add(db_vol)
    db.commit()
    db.refresh(db_vol)
    return db_vol

def update_volunteer(db: Session, volunteer_id: int, update_data: schemas.VolunteerUpdate):
    db_vol = get_volunteer(db, volunteer_id)
    if not db_vol:
        return None
    for key, val in update_data.model_dump(exclude_unset=True).items():
        setattr(db_vol, key, val)
    db.commit()
    db.refresh(db_vol)
    return db_vol

def check_in_volunteer(db: Session, volunteer_id: int):
    db_vol = get_volunteer(db, volunteer_id)
    if not db_vol:
        return None
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db_vol.status = "Checked In"
    db_vol.check_in_time = now_str
    db.commit()
    db.refresh(db_vol)
    return db_vol

def check_out_volunteer(db: Session, volunteer_id: int):
    db_vol = get_volunteer(db, volunteer_id)
    if not db_vol:
        return None
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db_vol.status = "Checked Out"
    db_vol.check_out_time = now_str
    db.commit()
    db.refresh(db_vol)
    return db_vol

# --- Shift & Assignment CRUD ---
def get_shifts_by_event(db: Session, event_id: int):
    return db.query(models.Shift).filter(models.Shift.event_id == event_id).all()

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
def get_tasks_by_event(db: Session, event_id: int):
    return db.query(models.Task).filter(models.Task.event_id == event_id).all()

def create_task(db: Session, task: schemas.TaskCreate):
    db_task = models.Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task(db: Session, task_id: int, update_data: schemas.TaskUpdate):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        return None
    for key, val in update_data.model_dump(exclude_unset=True).items():
        setattr(db_task, key, val)
    db.commit()
    db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: int):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        db.delete(db_task)
        db.commit()
        return True
    return False

# --- Announcement CRUD ---
def get_announcements_by_event(db: Session, event_id: int):
    return db.query(models.Announcement).filter(
        models.Announcement.event_id == event_id
    ).order_by(models.Announcement.id.desc()).all()

def create_announcement(db: Session, ann: schemas.AnnouncementCreate):
    db_ann = models.Announcement(**ann.model_dump())
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

    shifts = db.query(models.Shift).filter(models.Shift.event_id == current_event_id).all() if current_event_id else []
    total_shifts = len(shifts)
    filled_shifts = sum(1 for s in shifts if len(s.assignments) >= s.capacity)

    tasks = db.query(models.Task).filter(models.Task.event_id == current_event_id).all() if current_event_id else []
    total_tasks = len(tasks)
    pending_tasks = sum(1 for t in tasks if t.status == "todo")
    in_progress_tasks = sum(1 for t in tasks if t.status == "in_progress")
    done_tasks = sum(1 for t in tasks if t.status == "done")

    escalations = db.query(models.Escalation).filter(models.Escalation.event_id == current_event_id).all() if current_event_id else []
    active_escalations = sum(1 for e in escalations if e.status != "Resolved")
    critical_escalations = sum(1 for e in escalations if e.severity == "Critical" and e.status != "Resolved")

    # Zone summary
    zones = ["Main Stage", "North Gate", "South Exit", "Medical Tent", "Food Court", "VIP Lounge", "General"]
    zone_data = []
    for z in zones:
        zone_tasks = sum(1 for t in tasks if t.zone == z)
        zone_incidents = sum(1 for e in escalations if e.zone == z and e.status != "Resolved")
        zone_volunteers = sum(1 for s in shifts if s.zone == z for _ in s.assignments)
        
        # calculate crowd density status indicator
        status_flag = "Normal"
        if zone_incidents > 0 or zone_tasks > 3:
            status_flag = "Attention Needed"
        if any(e.severity == "Critical" and e.status != "Resolved" for e in escalations if e.zone == z):
            status_flag = "Critical Surge"

        zone_data.append({
            "zone": z,
            "active_tasks": zone_tasks,
            "open_incidents": zone_incidents,
            "assigned_staff": zone_volunteers,
            "status": status_flag
        })

    return {
        "total_events": len(events),
        "active_event_id": current_event_id,
        "active_event_name": current_event_name,
        "total_volunteers": total_volunteers,
        "checked_in_volunteers": checked_in,
        "checked_out_volunteers": checked_out,
        "registered_volunteers": registered,
        "total_shifts": total_shifts,
        "filled_shifts": filled_shifts,
        "total_tasks": total_tasks,
        "pending_tasks": pending_tasks,
        "in_progress_tasks": in_progress_tasks,
        "done_tasks": done_tasks,
        "active_escalations": active_escalations,
        "critical_escalations": critical_escalations,
        "zones_crowd_summary": zone_data
    }

# --- Database Seeder ---
def seed_initial_data(db: Session):
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
        ("Inspect barricades at Gate 3", "Ensure emergency latch release is operational and signs are visible", "North Gate", "High", "in_progress", created_vols[1].id),
        ("Deploy 20 extra water cases to Medical Tent", "Crowd volume increased by 30% under direct sun", "Medical Tent", "Urgent", "todo", created_vols[4].id),
        ("Calibrate badge RFID scanners at Gate 1", "3 scanners reported slow NFC sync during testing", "Registration", "Medium", "done", created_vols[2].id),
        ("Direct overflow crowd toward South Concourse", "Prevent bottleneck around merchandise kiosks", "Main Stage", "Urgent", "in_progress", created_vols[6].id),
        ("Restock first-aid ice packs and electrolytes", "Coordinate with main ambulance supply liaison", "Medical Tent", "High", "todo", created_vols[0].id),
        ("Escort keynote panel speakers to Green Room B", "Check badges and supply briefing dossiers", "VIP Lounge", "Low", "done", None),
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
