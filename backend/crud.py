import os
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models, schemas
import assignment_engine
from jira_service import jira_service

# --- Event CRUD ---
ACTIVE_ASSIGNMENT_STATUSES = ("ASSIGNED", "CHECKED_IN")

def _active_assignments(shift: models.Shift):
    return [
        a for a in (shift.assignments or [])
        if (a.assignment_status or "ASSIGNED").upper() in ACTIVE_ASSIGNMENT_STATUSES
        and a.status in ("Assigned", "Confirmed", "Checked In")
    ]

def event_summary(event: models.Event) -> Dict[str, Any]:
    """Staffing numbers for an event, computed from its shifts and assignments."""
    shifts = event.shifts or []
    volunteer_ids = {a.volunteer_id for s in shifts for a in _active_assignments(s)}
    total_capacity = sum(int(s.capacity or 0) for s in shifts)
    open_positions = sum(assignment_engine.calculate_coverage(s)["coverage_gap"] for s in shifts)
    return {
        "volunteers_assigned": len(volunteer_ids),
        # Explicit requirement wins; otherwise the sum of shift headcounts
        "volunteer_target": int(event.volunteers_needed or 0) or total_capacity,
        "shift_count": len(shifts),
        "open_positions": open_positions,
        "zone_count": len(event.zones or []),
        "role_count": len(event.roles or []),
    }

def with_summary(event: models.Event) -> models.Event:
    for key, value in event_summary(event).items():
        setattr(event, key, value)
    return event

def get_events(
    db: Session,
    category: Optional[str] = None,
    featured: Optional[bool] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
):
    query = db.query(models.Event)
    if category:
        query = query.filter(models.Event.category.ilike(category.strip()))
    if featured is not None:
        query = query.filter(models.Event.is_featured == featured)
    if status:
        query = query.filter(models.Event.status.ilike(status.strip()))
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            models.Event.name.ilike(like) | models.Event.location.ilike(like) | models.Event.description.ilike(like)
        )
    query = query.order_by(models.Event.id.desc())
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    return [with_summary(e) for e in query.all()]

def get_event(db: Session, event_id: int):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    return with_summary(event) if event else None

def get_default_event(db: Session):
    """The default active event context is the first-created event (Event #1)."""
    return db.query(models.Event).order_by(models.Event.id.asc()).first()

def create_event(db: Session, event: schemas.EventCreate):
    db_event = models.Event(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return with_summary(db_event)

def update_event(db: Session, event_id: int, data: schemas.EventUpdate):
    db_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not db_event:
        return None
    changes = data.model_dump(exclude_unset=True)
    start = changes.get("start_date", db_event.start_date)
    end = changes.get("end_date", db_event.end_date)
    if start and end and end < start:
        raise ValueError("End must be after start")
    for key, value in changes.items():
        setattr(db_event, key, value)
    db.commit()
    db.refresh(db_event)
    return with_summary(db_event)

def get_event_categories(db: Session) -> List[Dict[str, Any]]:
    counts: Dict[str, int] = {}
    names: Dict[str, str] = {}
    for (category,) in db.query(models.Event.category).all():
        c = (category or "").strip()
        if not c:
            continue
        counts[c.lower()] = counts.get(c.lower(), 0) + 1
        names.setdefault(c.lower(), c)
    return [{"name": names[k], "event_count": counts[k]} for k in sorted(counts)]

def get_event_details(db: Session, event_id: int) -> Optional[Dict[str, Any]]:
    """Everything the event details page needs, in one response."""
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        return None
    summary = event_summary(event)

    shifts = []
    volunteers: Dict[int, Dict[str, Any]] = {}
    for s in sorted(event.shifts or [], key=lambda x: ((x.date or ""), x.start_time or "")):
        cov = assignment_engine.calculate_coverage(s)
        shifts.append({
            "id": s.id,
            "title": s.title,
            "date": s.date,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "zone": s.zone,
            "required_skill": s.required_skill,
            "mandatory_skill": s.mandatory_skill,
            "role_id": s.role_id,
            "role_name": s.role.name if s.role else None,
            "capacity": s.capacity,
            "assigned_count": cov["assigned_count"],
            "coverage_gap": cov["coverage_gap"],
            "coverage_status": cov["coverage_status"],
        })
        for a in _active_assignments(s):
            v = a.volunteer
            if not v:
                continue
            entry = volunteers.setdefault(v.id, {
                "id": v.id,
                "name": v.full_name,
                "skills": v.skills or "",
                "status": v.status,
                "shifts": [],
            })
            entry["shifts"].append({
                "shift_id": s.id,
                "title": s.title,
                "assignment_status": (a.assignment_status or "ASSIGNED").upper(),
            })

    return {
        **{c.name: getattr(event, c.name) for c in models.Event.__table__.columns},
        **summary,
        "zones": [
            {"id": z.id, "event_id": z.event_id, "name": z.name, "description": z.description or "", "created_at": z.created_at}
            for z in sorted(event.zones or [], key=lambda z: z.name.lower())
        ],
        "roles": [
            {
                "id": r.id, "event_id": r.event_id, "name": r.name, "description": r.description or "",
                "required_skill": r.required_skill or "", "needed_count": r.needed_count, "created_at": r.created_at,
            }
            for r in sorted(event.roles or [], key=lambda r: r.name.lower())
        ],
        "shifts": shifts,
        "volunteers": sorted(volunteers.values(), key=lambda v: v["name"].lower()),
        "open_shifts": [s for s in shifts if s["coverage_gap"] > 0],
    }

def get_event_zone_names(db: Session, event_id: int) -> List[str]:
    """Zones defined for the event plus any zone already used by its shifts, tasks or issues."""
    names = {z.name.strip() for z in db.query(models.Zone).filter(models.Zone.event_id == event_id).all()}
    for model in (models.Shift, models.Task, models.Issue):
        for (zone,) in db.query(model.zone).filter(model.event_id == event_id).distinct().all():
            if zone and zone.strip():
                names.add(zone.strip())
    return sorted(names, key=str.lower)

def get_known_skills(db: Session) -> List[str]:
    """Skill vocabulary drawn from roles, shifts and volunteer profiles."""
    skills: Dict[str, str] = {}
    def add(raw):
        for part in (raw or "").split(","):
            p = part.strip()
            if p and p.lower() not in ("general", "none"):
                skills.setdefault(p.lower(), p)
    for (v,) in db.query(models.Role.required_skill).all():
        add(v)
    for row in db.query(models.Shift.required_skill, models.Shift.mandatory_skill, models.Shift.optional_skill).all():
        for v in row:
            add(v)
    for (v,) in db.query(models.Volunteer.skills).all():
        add(v)
    return sorted(skills.values(), key=str.lower)

# --- Event cover images ---
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
EVENT_IMAGE_DIR = os.path.join(UPLOAD_DIR, "events")
IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024

def _sniff_image_type(data: bytes) -> Optional[str]:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return None

def _remove_stored_image(image_url: Optional[str]):
    if image_url and image_url.startswith("/uploads/events/"):
        path = os.path.join(EVENT_IMAGE_DIR, os.path.basename(image_url))
        if os.path.isfile(path):
            os.remove(path)

def save_event_image(db: Session, event_id: int, data: bytes):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        return None
    if not data:
        raise ValueError("Image file is empty")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("Image must be 5 MB or smaller")
    # Trust the file's bytes, not the client-declared content type
    kind = _sniff_image_type(data)
    if not kind:
        raise ValueError("Upload a JPEG, PNG, WebP or GIF image")
    os.makedirs(EVENT_IMAGE_DIR, exist_ok=True)
    filename = f"event-{event_id}-{uuid.uuid4().hex[:12]}{IMAGE_TYPES[kind]}"
    with open(os.path.join(EVENT_IMAGE_DIR, filename), "wb") as fh:
        fh.write(data)
    _remove_stored_image(event.image_url)
    event.image_url = f"/uploads/events/{filename}"
    db.commit()
    db.refresh(event)
    return with_summary(event)

def remove_event_image(db: Session, event_id: int):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        return None
    _remove_stored_image(event.image_url)
    event.image_url = ""
    db.commit()
    db.refresh(event)
    return with_summary(event)

# --- Zone CRUD ---
def get_zones_by_event(db: Session, event_id: int):
    return db.query(models.Zone).filter(models.Zone.event_id == event_id).order_by(models.Zone.name.asc()).all()

def _zone_name_taken(db: Session, event_id: int, name: str, exclude_id: Optional[int] = None) -> bool:
    q = db.query(models.Zone).filter(models.Zone.event_id == event_id, models.Zone.name.ilike(name))
    if exclude_id:
        q = q.filter(models.Zone.id != exclude_id)
    return q.first() is not None

def create_zone(db: Session, event_id: int, zone: schemas.ZoneCreate):
    if not db.query(models.Event).filter(models.Event.id == event_id).first():
        raise LookupError("Event not found")
    if _zone_name_taken(db, event_id, zone.name):
        raise ValueError(f"Zone '{zone.name}' already exists for this event")
    db_zone = models.Zone(event_id=event_id, **zone.model_dump())
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    return db_zone

def update_zone(db: Session, zone_id: int, zone: schemas.ZoneCreate):
    db_zone = db.query(models.Zone).filter(models.Zone.id == zone_id).first()
    if not db_zone:
        return None
    if _zone_name_taken(db, db_zone.event_id, zone.name, exclude_id=zone_id):
        raise ValueError(f"Zone '{zone.name}' already exists for this event")
    old_name = db_zone.name
    db_zone.name = zone.name
    db_zone.description = zone.description or ""
    # Keep shifts, tasks and issues that referenced the old zone name in sync
    if old_name != zone.name:
        for model in (models.Shift, models.Task, models.Issue):
            db.query(model).filter(model.event_id == db_zone.event_id, model.zone == old_name).update(
                {model.zone: zone.name}, synchronize_session=False
            )
    db.commit()
    db.refresh(db_zone)
    return db_zone

def delete_zone(db: Session, zone_id: int) -> bool:
    db_zone = db.query(models.Zone).filter(models.Zone.id == zone_id).first()
    if not db_zone:
        return False
    db.delete(db_zone)
    db.commit()
    return True

# --- Role CRUD ---
def get_roles_by_event(db: Session, event_id: int):
    return db.query(models.Role).filter(models.Role.event_id == event_id).all()

def create_role(db: Session, role: schemas.RoleCreate):
    if not db.query(models.Event).filter(models.Event.id == role.event_id).first():
        raise LookupError("Event not found")
    db_role = models.Role(**role.model_dump())
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

def update_role(db: Session, role_id: int, data: schemas.RoleUpdate):
    db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not db_role:
        return None
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes:
        name = (changes["name"] or "").strip()
        if not name:
            raise ValueError("Role name is required")
        changes["name"] = name
    if changes.get("needed_count") is not None and changes["needed_count"] < 0:
        raise ValueError("Needed count cannot be negative")
    for key, value in changes.items():
        setattr(db_role, key, value)
    db.commit()
    db.refresh(db_role)
    return db_role

def delete_role(db: Session, role_id: int) -> bool:
    db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not db_role:
        return False
    # Shifts keep existing; they just lose the role link
    db.query(models.Shift).filter(models.Shift.role_id == role_id).update({models.Shift.role_id: None}, synchronize_session=False)
    db.delete(db_role)
    db.commit()
    return True

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
        if a.status in ("Assigned", "Confirmed", "Checked In") and (getattr(a, 'assignment_status', '') or "").upper() not in ("DROPPED_OUT", "NO_SHOW")
    ]

    contact = {
        "email": db_vol.email,
        "phone": db_vol.phone or "",
        "emergency_contact": db_vol.emergency_contact or ""
    }

    slots_data = [
        {
            "id": s.id,
            "volunteer_id": s.volunteer_id,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "created_at": s.created_at
        }
        for s in (db_vol.availability_slots or [])
    ]

    reliability_score = assignment_engine.calculate_reliability_score(db_vol)

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
        "completed_shifts": db_vol.completed_shifts_count,
        "no_shows": db_vol.no_shows_count,
        "dropouts": db_vol.dropouts_count,
        "reliability_score": reliability_score,
        "availability_slots": slots_data,
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

# --- Volunteer Availability Slots CRUD ---
def validate_availability_times(start_time: str, end_time: str):
    s_min = assignment_engine.parse_time_to_minutes(start_time)
    e_min = assignment_engine.parse_time_to_minutes(end_time)
    if s_min is None or e_min is None:
        raise ValueError("Invalid time format for start_time or end_time")
    if s_min >= e_min:
        raise ValueError("start_time must be strictly earlier than end_time")
    return s_min, e_min

def get_volunteer_availabilities(db: Session, volunteer_id: int):
    return db.query(models.VolunteerAvailability).filter(
        models.VolunteerAvailability.volunteer_id == volunteer_id
    ).order_by(models.VolunteerAvailability.id.asc()).all()

def create_volunteer_availability(db: Session, volunteer_id: int, avail: schemas.AvailabilityCreate):
    vol = get_volunteer(db, volunteer_id)
    if not vol:
        raise ValueError("Volunteer not found")

    s_min, e_min = validate_availability_times(avail.start_time, avail.end_time)
    day = str(avail.day_of_week).strip().capitalize()

    # Check for overlapping slots for the same volunteer and day
    existing_slots = db.query(models.VolunteerAvailability).filter(
        models.VolunteerAvailability.volunteer_id == volunteer_id,
        models.VolunteerAvailability.day_of_week == day
    ).all()

    for es in existing_slots:
        es_s = assignment_engine.parse_time_to_minutes(es.start_time)
        es_e = assignment_engine.parse_time_to_minutes(es.end_time)
        if es_s is not None and es_e is not None:
            if max(s_min, es_s) < min(e_min, es_e):
                raise ValueError(f"Overlapping availability slot exists on {day} ({es.start_time} - {es.end_time})")

    db_avail = models.VolunteerAvailability(
        volunteer_id=volunteer_id,
        day_of_week=day,
        start_time=avail.start_time.strip(),
        end_time=avail.end_time.strip()
    )
    db.add(db_avail)
    db.commit()
    db.refresh(db_avail)
    return db_avail

def update_volunteer_availability(db: Session, avail_id: int, avail: schemas.AvailabilityCreate):
    db_avail = db.query(models.VolunteerAvailability).filter(models.VolunteerAvailability.id == avail_id).first()
    if not db_avail:
        return None

    s_min, e_min = validate_availability_times(avail.start_time, avail.end_time)
    day = str(avail.day_of_week).strip().capitalize()

    existing_slots = db.query(models.VolunteerAvailability).filter(
        models.VolunteerAvailability.volunteer_id == db_avail.volunteer_id,
        models.VolunteerAvailability.day_of_week == day,
        models.VolunteerAvailability.id != avail_id
    ).all()

    for es in existing_slots:
        es_s = assignment_engine.parse_time_to_minutes(es.start_time)
        es_e = assignment_engine.parse_time_to_minutes(es.end_time)
        if es_s is not None and es_e is not None:
            if max(s_min, es_s) < min(e_min, es_e):
                raise ValueError(f"Overlapping availability slot exists on {day} ({es.start_time} - {es.end_time})")

    db_avail.day_of_week = day
    db_avail.start_time = avail.start_time.strip()
    db_avail.end_time = avail.end_time.strip()
    db.commit()
    db.refresh(db_avail)
    return db_avail

def delete_volunteer_availability(db: Session, avail_id: int):
    db_avail = db.query(models.VolunteerAvailability).filter(models.VolunteerAvailability.id == avail_id).first()
    if not db_avail:
        return False
    db.delete(db_avail)
    db.commit()
    return True

CHECK_IN_EARLY_WINDOW_MIN = 60  # volunteers may check in up to 1h before shift start

def _shift_window(shift: models.Shift):
    """Return (start_datetime, end_datetime) for a shift with a concrete date, else None."""
    try:
        day = datetime.strptime((shift.date or "").strip(), "%Y-%m-%d")
    except ValueError:
        return None
    s_min = assignment_engine.parse_time_to_minutes(shift.start_time)
    e_min = assignment_engine.parse_time_to_minutes(shift.end_time)
    if s_min is None or e_min is None:
        return None
    if e_min <= s_min:
        e_min += 24 * 60
    return day + timedelta(minutes=s_min), day + timedelta(minutes=e_min)

def select_check_in_assignment(db_vol: models.Volunteer, now: datetime):
    """
    Pick the one assignment a check-in applies to:
    1. A shift running now (or starting within the early check-in window).
    2. Otherwise the volunteer's next upcoming shift.
    Shifts that already ended are never checked into.
    """
    pending = [
        a for a in (db_vol.shift_assignments or [])
        if a.shift and a.status in ("Assigned", "Confirmed")
        and (a.assignment_status or "ASSIGNED").upper() == "ASSIGNED"
    ]
    upcoming = []
    for a in pending:
        window = _shift_window(a.shift)
        if window is None:
            upcoming.append((datetime.max, a))
            continue
        start, end = window
        if end < now:
            continue
        if start - timedelta(minutes=CHECK_IN_EARLY_WINDOW_MIN) <= now <= end:
            return a
        upcoming.append((start, a))
    if not upcoming:
        # If all shifts ended in the past (e.g. demo/seed database with historical dates),
        # fall back to earliest pending assignment so check-in still links cleanly
        pending.sort(key=lambda a: (assignment_engine.parse_time_to_minutes(a.shift.start_time) or 0))
        return pending[0] if pending else None
    upcoming.sort(key=lambda item: (item[0], assignment_engine.parse_time_to_minutes(item[1].shift.start_time) or 0))
    return upcoming[0][1]

def check_in_volunteer(db: Session, volunteer_id: int):
    db_vol = get_volunteer(db, volunteer_id)
    if not db_vol:
        return None, "Volunteer not found"

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

    # Sync assignment-level status for the single shift this check-in belongs to
    target = select_check_in_assignment(db_vol, datetime.now())
    if target:
        target.assignment_status = "CHECKED_IN"
        target.status = "Checked In"

    db.commit()
    db.refresh(db_vol)
    db.refresh(record)
    return db_vol, record

def check_out_volunteer(db: Session, volunteer_id: int):
    db_vol = get_volunteer(db, volunteer_id)
    if not db_vol:
        return None, None, "Volunteer not found"

    if db_vol.status != "Checked In":
        return None, None, f"Volunteer '{db_vol.full_name}' is not currently checked in"

    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

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

    # Sync assignment-level status: complete active checked-in assignment
    now_utc = datetime.utcnow()
    for a in (db_vol.shift_assignments or []):
        if a.assignment_status == "CHECKED_IN" or a.status == "Checked In":
            a.assignment_status = "COMPLETED"
            a.status = "Completed"
            a.completed_at = now_utc

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
        existing.status = "Assigned"
        existing.assignment_status = "ASSIGNED"
        existing.assigned_at = datetime.utcnow()
        existing.dropout_at = None
        existing.no_show_at = None
        existing.completed_at = None
        db.commit()
        db.refresh(existing)
        return existing

    assignment = models.ShiftAssignment(
        shift_id=shift_id,
        volunteer_id=volunteer_id,
        status="Assigned",
        assignment_status="ASSIGNED",
        assigned_at=datetime.utcnow()
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
        "jira_issue_key": task.jira_issue_key,
        "jira_issue_id": task.jira_issue_id,
        "jira_synced_at": task.jira_synced_at,
        "jira_issue_url": f"{jira_service.base_url}/browse/{task.jira_issue_key}" if (task.jira_issue_key and jira_service.base_url) else None,
        "jira_sync_status": getattr(task, "_jira_sync_status", None),
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "created_time": c_time,
        "updated_time": u_time,
    }

def get_tasks(db: Session, event_id: int = None, zone: str = None, volunteer_id: int = None):
    query = db.query(models.Task)
    if event_id:
        query = query.filter(models.Task.event_id == event_id)
    if zone and zone != "All Zones":
        query = query.filter(models.Task.zone == zone)
    if volunteer_id:
        query = query.filter(models.Task.assigned_volunteer_id == volunteer_id)
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
        jira_issue_key=getattr(task, "jira_issue_key", None),
        jira_issue_id=getattr(task, "jira_issue_id", None),
        jira_synced_at=getattr(task, "jira_synced_at", None),
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
    if "jira_issue_key" in data and data["jira_issue_key"] is not None:
        db_task.jira_issue_key = data["jira_issue_key"]
    if "jira_issue_id" in data and data["jira_issue_id"] is not None:
        db_task.jira_issue_id = data["jira_issue_id"]
    if "jira_synced_at" in data and data["jira_synced_at"] is not None:
        db_task.jira_synced_at = data["jira_synced_at"]

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
        ev = get_default_event(db)
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
        original_assigned_coordinator=coordinator,
        escalation_level=0,
        escalated_at=None,
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

def get_escalated_issues(db: Session):
    """Retrieve all currently escalated issues."""
    return db.query(models.Issue).filter(
        models.Issue.escalation_level > 0,
        models.Issue.status != "RESOLVED"
    ).order_by(models.Issue.escalation_level.desc(), models.Issue.id.desc()).all()

# SLA escalation hierarchy; level 0 is the initially routed zone-level owner
ESCALATION_TIERS = {
    0: "Zone Lead",
    1: "Sector Supervisor",
    2: "Head of Operations",
    3: "Event Director",
}

def check_issue_escalations(db: Session, now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """
    Check open issues and escalate based on SLA windows:
    - CRITICAL -> 2 minutes
    - HIGH -> 5 minutes
    - MEDIUM -> 15 minutes
    - LOW -> no automatic escalation
    Escalation chain (ESCALATION_TIERS):
    Level 0: Zone Lead (initial routed owner)
    Level 1: Sector Supervisor
    Level 2: Head of Operations
    Level 3: Event Director
    Maximum level = 3.
    Acknowledging the issue stops further escalation.
    Creates coordinator-only announcement on level increase.
    Avoids duplicate announcements.
    """
    if now is None:
        now = datetime.utcnow()
    elif isinstance(now, str):
        now = datetime.fromisoformat(now.replace("Z", "+00:00")).replace(tzinfo=None)

    sla_seconds = {
        "CRITICAL": 120,   # 2 minutes
        "HIGH": 300,       # 5 minutes
        "MEDIUM": 900,     # 15 minutes
    }

    open_issues = db.query(models.Issue).filter(
        models.Issue.status == "OPEN",
        models.Issue.escalation_level < 3
    ).all()

    escalated = []
    for issue in open_issues:
        prio = str(issue.priority or "").upper().strip()
        if prio not in sla_seconds:
            continue

        sla = sla_seconds[prio]
        base_time = issue.escalated_at if (issue.escalated_at and (issue.escalation_level or 0) > 0) else issue.created_at
        if not base_time:
            base_time = now

        elapsed = (now - base_time).total_seconds()
        if elapsed >= sla:
            old_level = issue.escalation_level or 0
            new_level = min(3, old_level + 1)
            issue.escalation_level = new_level
            issue.escalated_at = now
            if not issue.original_assigned_coordinator:
                issue.original_assigned_coordinator = issue.assigned_coordinator

            new_role = ESCALATION_TIERS[new_level]
            issue.assigned_coordinator = new_role

            ann_title = f"Issue Escalated to Level {new_level}: {issue.title}"
            existing_ann = db.query(models.Announcement).filter(
                models.Announcement.title == ann_title,
                models.Announcement.event_id == issue.event_id
            ).first()

            if not existing_ann:
                ann = models.Announcement(
                    event_id=issue.event_id or 1,
                    title=ann_title,
                    content=f"Issue '{issue.title}' in {issue.zone} escalated to Level {new_level} (SLA breach of {prio} priority). Reassigned to {new_role}.",
                    message=f"Issue '{issue.title}' in {issue.zone} escalated to Level {new_level}. Reassigned to {new_role}.",
                    target_type="COORDINATORS",
                    target_value="",
                    priority="Critical Alert" if prio == "CRITICAL" else "High",
                    author="Escalation Engine",
                    created_at=now
                )
                db.add(ann)

            db.commit()
            db.refresh(issue)
            escalated.append({
                "issue_id": issue.id,
                "title": issue.title,
                "priority": issue.priority,
                "zone": issue.zone,
                "escalation_level": new_level,
                "original_assigned_coordinator": issue.original_assigned_coordinator,
                "assigned_coordinator": issue.assigned_coordinator,
                "escalated_at": issue.escalated_at
            })

    return escalated

def check_no_shows(db: Session, now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """
    Evaluate assignments for automatic no-show:
    - status = ASSIGNED
    - shift has started
    - now >= shift_start + 15 minutes grace period
    - now <= shift_end (do NOT mark past shifts that ended earlier as no-show)
    - shift date must be today (a dated shift from a previous week never matches by weekday)
    - volunteer has not checked in
    - volunteer has not dropped out
    Shift times are event-local, so the default clock is local time.
    """
    if now is None:
        now = datetime.now()
    elif isinstance(now, str):
        now = datetime.fromisoformat(now.replace("Z", "+00:00")).replace(tzinfo=None)

    assignments = db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.status.in_(["Assigned", "Confirmed"]),
        (models.ShiftAssignment.assignment_status == "ASSIGNED") | (models.ShiftAssignment.assignment_status == None)
    ).all()

    now_day_str = now.strftime("%A")
    now_minutes = now.hour * 60 + now.minute

    no_shows_detected = []
    for a in assignments:
        shift = a.shift
        volunteer = a.volunteer
        if not shift or not volunteer:
            continue

        if volunteer.status == "Checked In" or a.status == "Checked In" or a.status == "Dropped Out":
            continue
        if (getattr(a, 'assignment_status', '') or "").upper() in ("CHECKED_IN", "DROPPED_OUT", "NO_SHOW", "COMPLETED"):
            continue

        shift_date = (shift.date or "2026-10-02").strip()
        try:
            is_today = datetime.strptime(shift_date, "%Y-%m-%d").date() == now.date()
        except ValueError:
            # Recurring shifts declared by weekday name only
            is_today = assignment_engine.get_day_of_week_from_date(shift_date).lower() == now_day_str.lower()
        if not is_today:
            continue

        s_min = assignment_engine.parse_time_to_minutes(shift.start_time)
        e_min = assignment_engine.parse_time_to_minutes(shift.end_time)
        if s_min is None or e_min is None:
            continue
        if e_min <= s_min:
            e_min += 24 * 60

        grace_period_min = s_min + 15

        if now_minutes >= grace_period_min and now_minutes <= e_min:
            a.status = "NO_SHOW"
            a.assignment_status = "NO_SHOW"
            a.no_show_at = now
            db.commit()
            db.refresh(a)
            db.refresh(shift)

            cov = assignment_engine.calculate_coverage(shift)
            replacements = assignment_engine.get_shift_suggestions(db, shift.id, limit=2)

            ann_title = f"No-Show Alert: {volunteer.full_name} for {shift.title}"
            existing_ann = db.query(models.Announcement).filter(
                models.Announcement.title == ann_title,
                models.Announcement.event_id == shift.event_id
            ).first()

            if not existing_ann:
                ann = models.Announcement(
                    event_id=shift.event_id,
                    title=ann_title,
                    content=f"Volunteer {volunteer.full_name} missed 15-min check-in window for '{shift.title}' in {shift.zone}. Staffing gap: {cov['coverage_gap']}.",
                    message=f"No-show: {volunteer.full_name} for '{shift.title}'. Coverage gap: {cov['coverage_gap']}.",
                    target_type="COORDINATORS",
                    target_value="",
                    priority="High",
                    author="Attendance Monitor",
                    created_at=now
                )
                db.add(ann)
                db.commit()

            no_shows_detected.append({
                "assignment_id": a.id,
                "shift_id": shift.id,
                "shift_title": shift.title,
                "zone": shift.zone,
                "volunteer_id": volunteer.id,
                "volunteer_name": volunteer.full_name,
                "no_show_at": a.no_show_at,
                "coverage_gap": cov["coverage_gap"],
                "coverage_status": cov["coverage_status"],
                "replacement_suggestions": replacements
            })

    return no_shows_detected

# --- Announcement CRUD ---
# Audiences: EVERYONE, VOLUNTEERS, COORDINATORS, or ZONE (target_value = zone name).
# ROLE (target_value = role/team name) is still accepted for targeted team broadcasts.
ANNOUNCEMENT_AUDIENCES = ("EVERYONE", "VOLUNTEERS", "COORDINATORS", "ZONE", "ROLE")

def normalize_audience(target_type: Optional[str], target_value: Optional[str]):
    t = str(target_type or "EVERYONE").strip().upper()
    v = (target_value or "").strip()
    aliases = {"ALL": "EVERYONE", "VOLUNTEER": "VOLUNTEERS", "COORDINATOR": "COORDINATORS"}
    t = aliases.get(t, t)
    # Legacy coordinator-only alerts were stored as ROLE/COORDINATOR
    if t == "ROLE" and v.upper() in ("COORDINATOR", "COORDINATORS"):
        return "COORDINATORS", ""
    if t not in ANNOUNCEMENT_AUDIENCES:
        raise ValueError(f"Invalid announcement audience '{target_type}'. Use one of: EVERYONE, VOLUNTEERS, COORDINATORS, ZONE")
    if t in ("ZONE", "ROLE") and not v:
        raise ValueError(f"target_value is required for {t} announcements")
    if t in ("EVERYONE", "VOLUNTEERS", "COORDINATORS"):
        v = ""
    return t, v

def announcement_visible_to_volunteer(ann: models.Announcement, zones: set, roles: set) -> bool:
    t = (ann.target_type or "EVERYONE").upper()
    v = (ann.target_value or "").strip().lower()
    if t in ("EVERYONE", "VOLUNTEERS"):
        return True
    if t == "ZONE":
        return v in zones
    if t == "ROLE":
        return v in roles
    return False

def get_announcements(
    db: Session,
    event_id: Optional[int] = None,
    target_type: Optional[str] = None,
    volunteer_id: Optional[int] = None
):
    query = db.query(models.Announcement)
    if event_id is not None:
        query = query.filter(models.Announcement.event_id == event_id)
    if target_type:
        query = query.filter(models.Announcement.target_type == target_type.upper())
    announcements = query.order_by(models.Announcement.id.desc()).all()

    if volunteer_id is not None:
        vol = get_volunteer(db, volunteer_id)
        if not vol:
            return []
        active = [
            a for a in (vol.shift_assignments or [])
            if a.shift and (a.assignment_status or "").upper() in ("ASSIGNED", "CHECKED_IN")
        ]
        zones = {(a.shift.zone or "").strip().lower() for a in active}
        roles = {(a.shift.role.name or "").strip().lower() for a in active if a.shift.role}
        announcements = [a for a in announcements if announcement_visible_to_volunteer(a, zones, roles)]
    return announcements

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
    data["target_type"], data["target_value"] = normalize_audience(data.get("target_type"), data.get("target_value"))

    if data.get("event_id") is None:
        ev = get_default_event(db)
        if not ev:
            raise ValueError("No event exists to attach the announcement to")
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
    if not active_event:
        active_event = get_default_event(db)
    
    current_event_id = active_event.id if active_event else None
    current_event_name = active_event.name if active_event else "No Event"

    volunteers = db.query(models.Volunteer).all()
    total_volunteers = len(volunteers)
    checked_in = sum(1 for v in volunteers if v.status == "Checked In")
    checked_out = sum(1 for v in volunteers if v.status == "Checked Out")
    registered = sum(1 for v in volunteers if v.status not in ("Checked In", "Checked Out"))
    available_volunteers = sum(1 for v in volunteers if v.status != "Checked Out")
    total_volunteer_hours = round(sum(v.total_hours_worked for v in volunteers), 2)

    shifts = db.query(models.Shift).filter(models.Shift.event_id == current_event_id).all() if current_event_id else []
    total_shifts = len(shifts)
    shifts_coverage_list = [assignment_engine.calculate_coverage(s) for s in shifts]
    filled_shifts = sum(1 for c in shifts_coverage_list if c["coverage_gap"] == 0)

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
            "escalation_level": i.escalation_level or 0,
            "escalation_tier": ESCALATION_TIERS.get(i.escalation_level or 0, "Event Director"),
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

    # Zone summary: every zone referenced by this event's shifts, tasks, issues or incidents
    zones = sorted(
        {s.zone for s in shifts if s.zone}
        | {t.zone for t in tasks if t.zone}
        | {i.zone for i in all_issues if i.zone}
        | {e.zone for e in escalations if e.zone}
    )
    zone_data = []
    for z in zones:
        zone_tasks = sum(1 for t in tasks if t.zone == z and str(t.status).upper() != "RESOLVED")
        zone_incidents = sum(1 for e in escalations if e.zone == z and e.status != "Resolved")
        zone_issues = sum(1 for i in all_issues if i.zone == z and str(i.status).upper() != "RESOLVED")
        zone_volunteers = sum(c["assigned_count"] for s, c in zip(shifts, shifts_coverage_list) if s.zone == z)

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

    # Phase 6: Staffing Rebalancing, Coverage Gaps & Replacement Needs
    rebalance_data = assignment_engine.rebalance_assignments(db, current_event_id, apply=False)
    rebalancing_suggestions = rebalance_data.get("suggestions", [])
    understaffed_zones = rebalance_data.get("understaffed_zones", [])
    overstaffed_zones = rebalance_data.get("overstaffed_zones", [])
    understaffed_shifts_count = rebalance_data.get("understaffed_shifts_count", 0)
    overstaffed_shifts_count = rebalance_data.get("overstaffed_shifts_count", 0)

    # Coverage gaps count and replacement candidates for deficient shifts
    total_coverage_gaps = sum(c["coverage_gap"] for c in shifts_coverage_list)

    replacement_needed_shifts = []
    for s, cov in zip(shifts, shifts_coverage_list):
        if cov["coverage_gap"] > 0:
            top_recs = assignment_engine.get_shift_suggestions(db, s.id, limit=2)
            replacement_needed_shifts.append({
                "shift_id": s.id,
                "shift_title": s.title,
                "zone": s.zone,
                "required_skill": s.required_skill,
                "coverage_gap": cov["coverage_gap"],
                "coverage_status": cov["coverage_status"],
                "coverage_percentage": cov["coverage_percentage"],
                "suggested_replacements": top_recs
            })

    # Phase 6 & Enhancements: Escalations, No-shows & Metrics
    escalated_issues_count = sum(1 for i in all_issues if (i.escalation_level or 0) > 0 and str(i.status).upper() != "RESOLVED")
    escalated_issues_list = [
        {
            "id": i.id,
            "title": i.title,
            "priority": i.priority,
            "zone": i.zone,
            "escalation_level": i.escalation_level,
            "escalation_tier": ESCALATION_TIERS.get(i.escalation_level or 0, "Event Director"),
            "original_assigned_coordinator": i.original_assigned_coordinator,
            "assigned_coordinator": i.assigned_coordinator,
            "created_at": i.created_at.isoformat() if i.created_at else None,
            "escalated_at": i.escalated_at.isoformat() if i.escalated_at else None,
            "status": i.status
        }
        for i in all_issues
        if (i.escalation_level or 0) > 0 and str(i.status).upper() != "RESOLVED"
    ]
    no_shows_count = sum(
        1 for s in shifts for a in s.assignments
        if (a.status or "").upper() == "NO_SHOW" or (a.assignment_status or "").upper() == "NO_SHOW"
    )

    return {
        "total_events": len(events),
        "active_events": sum(1 for e in events if (e.status or "").lower() == "active"),
        "upcoming_events": sum(1 for e in events if (e.status or "").lower() == "upcoming"),
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
        "escalated_issues_count": escalated_issues_count,
        "no_shows_count": no_shows_count,
        "urgent_issues": urgent_issues_list,
        "escalated_issues": escalated_issues_list,
        "active_escalations": active_escalations,
        "critical_escalations": critical_escalations,
        "coverage_gaps_count": total_coverage_gaps,
        "understaffed_shifts_count": understaffed_shifts_count,
        "overstaffed_shifts_count": overstaffed_shifts_count,
        "understaffed_zones": understaffed_zones,
        "overstaffed_zones": overstaffed_zones,
        "rebalancing_suggestions": rebalancing_suggestions,
        "replacement_needed_shifts": replacement_needed_shifts,
        "zones_crowd_summary": zone_data
    }

# --- Database Seeder ---
def seed_initial_data(db: Session, force_reset: bool = False):
    if force_reset:
        for (image_url,) in db.query(models.Event.image_url).all():
            _remove_stored_image(image_url)
        db.query(models.Issue).delete()
        db.query(models.Announcement).delete()
        db.query(models.Escalation).delete()
        db.query(models.Task).delete()
        db.query(models.ShiftAssignment).delete()
        db.query(models.AttendanceRecord).delete()
        db.query(models.VolunteerAvailability).delete()
        db.query(models.Shift).delete()
        db.query(models.Role).delete()
        db.query(models.Zone).delete()
        db.query(models.Volunteer).delete()
        db.query(models.Event).delete()
        db.commit()

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

    # Seed sample availability slots if none exist for seeded volunteers
    if db.query(models.VolunteerAvailability).count() == 0:
        vols = db.query(models.Volunteer).all()
        if len(vols) >= 4:
            # Priya (Medical) - Friday 08:00 - 18:00
            db.add(models.VolunteerAvailability(volunteer_id=vols[0].id, day_of_week="Friday", start_time="08:00", end_time="18:00"))
            # Alex (Crowd Control) - Friday 08:00 - 14:00
            db.add(models.VolunteerAvailability(volunteer_id=vols[1].id, day_of_week="Friday", start_time="08:00", end_time="14:00"))
            # Marcus (Registration) - Friday 08:00 - 14:00
            db.add(models.VolunteerAvailability(volunteer_id=vols[2].id, day_of_week="Friday", start_time="08:00", end_time="14:00"))
            # David Kim (Logistics) - Friday 08:00 - 18:00
            db.add(models.VolunteerAvailability(volunteer_id=vols[4].id, day_of_week="Friday", start_time="08:00", end_time="18:00"))
            # Note: Other volunteers have NO slots to demonstrate backward compatibility (NO SLOTS = UNRESTRICTED)
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
        status="Active",
        category="Festival",
        is_featured=True,
        volunteers_needed=14
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
        ("Elena Rostova", "elena.r@example.com", "+1-555-0104", "VIP Handling, Hospitality, Event Operations", "Available", "Friend: +1-555-9004"),
        ("David Kim", "david.kim@example.com", "+1-555-0105", "Logistics, Forklift License, Heavy Lifting", "Checked In", "Father: +1-555-9005"),
        ("Sarah Jenkins", "sarah.j@example.com", "+1-555-0106", "First Aid, AED Certified, Nursing Student", "Available", "Partner: +1-555-9006"),
        ("Jamal Washington", "jamal.w@example.com", "+1-555-0107", "Crowd Control, Security Awareness, Conflict Resolution", "Checked In", "Brother: +1-555-9007"),
        ("Aisha Patel", "aisha.patel@example.com", "+1-555-0108", "Customer Service, Public Speaking, Info Desk", "Checked Out", "Aunt: +1-555-9008"),
        ("Liam O'Connor", "liam.oc@example.com", "+1-555-0109", "Logistics, Stage Tech, Radio Comms", "Available", "Mother: +1-555-9009"),
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

    # Seed explicit availability slots for demo volunteers
    db.add(models.VolunteerAvailability(volunteer_id=created_vols[0].id, day_of_week="Friday", start_time="08:00", end_time="18:00"))
    db.add(models.VolunteerAvailability(volunteer_id=created_vols[1].id, day_of_week="Friday", start_time="08:00", end_time="14:00"))
    db.add(models.VolunteerAvailability(volunteer_id=created_vols[2].id, day_of_week="Friday", start_time="08:00", end_time="14:00"))
    db.add(models.VolunteerAvailability(volunteer_id=created_vols[4].id, day_of_week="Friday", start_time="08:00", end_time="18:00"))
    db.commit()

    # 4. Shifts
    shifts_data = [
        ("Morning Gate Surge - North Entrance", "08:00", "12:00", "North Gate", "Crowd Control", 3, created_roles[0].id),
        ("Main Stage Soundcheck & Perimeters", "10:00", "14:00", "Main Stage", "Crowd Control", 2, created_roles[0].id),
        ("Medical Response Unit - North Field", "09:00", "15:00", "Medical Tent", "First Aid", 2, created_roles[1].id),
        ("VIP Welcome Lounge & Speaker Escort", "11:00", "16:00", "VIP Lounge", "VIP Handling", 2, created_roles[3].id),
        ("Attendee RFID Badge Check-In Desk", "08:00", "13:00", "Registration", "Customer Service", 3, created_roles[2].id),
        ("Hydration & Water Pack Distribution", "13:00", "17:00", "Food Court", "Logistics", 2, created_roles[4].id),
    ]
    created_shifts = []
    for title, st, et, zone, skill, cap, role_id in shifts_data:
        s = models.Shift(
            event_id=event1.id, role_id=role_id, title=title,
            date="2026-10-02",
            start_time=st, end_time=et, zone=zone,
            required_skill=skill, mandatory_skill="First Aid" if "Medical" in title else "",
            capacity=cap
        )
        db.add(s)
        created_shifts.append(s)
    db.commit()

    # Zones referenced by the demo shifts
    for zone_name in sorted({s[3] for s in shifts_data}):
        db.add(models.Zone(event_id=event1.id, name=zone_name))
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
