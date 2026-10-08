from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    location = Column(String(200), default="")
    start_date = Column(String(100), default="")  # "YYYY-MM-DD HH:MM"
    end_date = Column(String(100), default="")    # "YYYY-MM-DD HH:MM"
    status = Column(String(50), default="Active")  # Upcoming, Active, Completed
    category = Column(String(100), default="")
    image_url = Column(String(300), default="")  # path under /uploads, set by the image upload endpoint
    is_featured = Column(Boolean, default=False)
    volunteers_needed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    zones = relationship("Zone", back_populates="event", cascade="all, delete-orphan")
    roles = relationship("Role", back_populates="event", cascade="all, delete-orphan")
    shifts = relationship("Shift", back_populates="event", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="event", cascade="all, delete-orphan")
    announcements = relationship("Announcement", back_populates="event", cascade="all, delete-orphan")
    escalations = relationship("Escalation", back_populates="event", cascade="all, delete-orphan")
    issues = relationship("Issue", back_populates="event", cascade="all, delete-orphan")


class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="zones")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    required_skill = Column(String(100), default="")
    needed_count = Column(Integer, default=5)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="roles")
    shifts = relationship("Shift", back_populates="role")


class Volunteer(Base):
    __tablename__ = "volunteers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    phone = Column(String(50), default="")
    skills = Column(String(300), default="")  # comma-separated string e.g. "First Aid, Crowd Control"
    status = Column(String(50), default="Available")  # Available, Checked In, Checked Out
    check_in_time = Column(String(100), nullable=True)
    check_out_time = Column(String(100), nullable=True)
    emergency_contact = Column(String(150), default="")
    notes = Column(Text, default="")
    preferences = Column(String(200), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    shift_assignments = relationship("ShiftAssignment", back_populates="volunteer", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="assigned_volunteer")
    attendance_records = relationship("AttendanceRecord", back_populates="volunteer", cascade="all, delete-orphan")
    availability_slots = relationship("VolunteerAvailability", back_populates="volunteer", cascade="all, delete-orphan")

    @property
    def total_hours_worked(self) -> float:
        if not self.attendance_records:
            return 0.0
        return round(sum(r.hours_worked or 0.0 for r in self.attendance_records), 2)

    @property
    def completed_shifts_count(self) -> int:
        if not self.shift_assignments:
            return 0
        return sum(1 for a in self.shift_assignments if (a.status or "").upper() == "COMPLETED" or (getattr(a, 'assignment_status', '') or "").upper() == "COMPLETED")

    @property
    def no_shows_count(self) -> int:
        if not self.shift_assignments:
            return 0
        return sum(1 for a in self.shift_assignments if (a.status or "").upper() == "NO_SHOW" or (getattr(a, 'assignment_status', '') or "").upper() == "NO_SHOW")

    @property
    def dropouts_count(self) -> int:
        if not self.shift_assignments:
            return 0
        return sum(1 for a in self.shift_assignments if (a.status or "").upper() in ("DROPPED OUT", "DROPPED_OUT") or (getattr(a, 'assignment_status', '') or "").upper() in ("DROPPED OUT", "DROPPED_OUT"))


class VolunteerAvailability(Base):
    __tablename__ = "volunteer_availabilities"

    id = Column(Integer, primary_key=True, index=True)
    volunteer_id = Column(Integer, ForeignKey("volunteers.id"), nullable=False)
    day_of_week = Column(String(50), nullable=False)  # Monday, Tuesday, Wednesday, etc.
    start_time = Column(String(50), nullable=False)   # HH:MM
    end_time = Column(String(50), nullable=False)     # HH:MM
    created_at = Column(DateTime, default=datetime.utcnow)

    volunteer = relationship("Volunteer", back_populates="availability_slots")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    volunteer_id = Column(Integer, ForeignKey("volunteers.id"), nullable=False)
    check_in_time = Column(String(100), nullable=False)
    check_out_time = Column(String(100), nullable=True)
    hours_worked = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    volunteer = relationship("Volunteer", back_populates="attendance_records")


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    title = Column(String(150), nullable=False)
    date = Column(String(50), default="2026-10-02")
    start_time = Column(String(50), default="")
    end_time = Column(String(50), default="")
    zone = Column(String(100), default="Main Zone")  # e.g., North Gate, Stage A, Med Tent
    required_skill = Column(String(100), default="")
    mandatory_skill = Column(String(100), default="")
    optional_skill = Column(String(100), default="")
    capacity = Column(Integer, default=2)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="shifts")
    role = relationship("Role", back_populates="shifts")
    assignments = relationship("ShiftAssignment", back_populates="shift", cascade="all, delete-orphan")

    @property
    def day_of_week(self) -> str:
        """Weekday derived from the shift date, so it can never drift out of sync with it."""
        from assignment_engine import get_day_of_week_from_date
        return get_day_of_week_from_date(self.date)


class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"

    id = Column(Integer, primary_key=True, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=False)
    volunteer_id = Column(Integer, ForeignKey("volunteers.id"), nullable=False)
    status = Column(String(50), default="Assigned")  # Assigned, Confirmed, Completed, Dropped Out, NO_SHOW
    assignment_status = Column(String(50), default="ASSIGNED")  # ASSIGNED, CHECKED_IN, COMPLETED, DROPPED_OUT, NO_SHOW
    assigned_at = Column(DateTime, default=datetime.utcnow)
    no_show_at = Column(DateTime, nullable=True)
    dropout_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    shift = relationship("Shift", back_populates="assignments")
    volunteer = relationship("Volunteer", back_populates="shift_assignments")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    zone = Column(String(100), default="General")
    priority = Column(String(50), default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(50), default="OPEN")  # OPEN, IN_PROGRESS, RESOLVED
    assigned_volunteer_id = Column(Integer, ForeignKey("volunteers.id"), nullable=True)
    jira_issue_key = Column(String(50), nullable=True)
    jira_issue_id = Column(String(50), nullable=True)
    jira_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    event = relationship("Event", back_populates="tasks")
    assigned_volunteer = relationship("Volunteer", back_populates="tasks")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    message = Column(Text, default="")
    target_type = Column(String(50), default="EVERYONE")  # EVERYONE, VOLUNTEERS, COORDINATORS, ZONE (ROLE for team broadcasts)
    target_value = Column(String(100), nullable=True, default="")
    priority = Column(String(50), default="General")  # General, High, Critical Alert
    author = Column(String(100), default="Event Coordinator")
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="announcements")


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    zone = Column(String(100), default="General")
    issue_type = Column(String(50), nullable=False)  # MEDICAL, CROWD_SURGE, MISSING_EQUIPMENT, SECURITY, OTHER
    priority = Column(String(50), default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(50), default="OPEN")  # OPEN, ACKNOWLEDGED, RESOLVED
    assigned_coordinator = Column(String(150), default="Event Coordinator")
    original_assigned_coordinator = Column(String(150), nullable=True)
    escalation_level = Column(Integer, default=0)  # 0 Zone Lead, 1 Sector Supervisor, 2 Head of Operations, 3 Event Director
    escalated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    event = relationship("Event", back_populates="issues")


class Escalation(Base):
    __tablename__ = "escalations"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    zone = Column(String(100), default="General")
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    severity = Column(String(50), default="Medium")  # Low, Medium, High, Critical
    status = Column(String(50), default="Open")  # Open, In Review, Resolved
    reported_by = Column(String(100), default="Staff")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(String(100), nullable=True)

    event = relationship("Event", back_populates="escalations")
