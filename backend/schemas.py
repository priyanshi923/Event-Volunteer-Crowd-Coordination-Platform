from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

# Mirrors crud.ESCALATION_TIERS (kept here to avoid a circular import)
ESCALATION_TIER_NAMES = {0: "Zone Lead", 1: "Sector Supervisor", 2: "Head of Operations", 3: "Event Director"}

# --- Event Schemas ---
EVENT_STATUSES = ("Upcoming", "Active", "Completed")


def normalize_event_datetime(value: Optional[str]) -> str:
    """Accept 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM' or ISO 'YYYY-MM-DDTHH:MM[:SS]'; store 'YYYY-MM-DD HH:MM'."""
    if value is None:
        return ""
    v = str(value).strip()
    if not v:
        return ""
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(v, fmt)
            return dt.strftime("%Y-%m-%d") if fmt == "%Y-%m-%d" else dt.strftime("%Y-%m-%d %H:%M")
        except ValueError:
            continue
    raise ValueError("Use the format YYYY-MM-DD HH:MM")


class EventFields(BaseModel):
    """Shared validation for create and update."""

    @field_validator("name", check_fields=False)
    @classmethod
    def _name(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Event name is required")
        if len(v) > 200:
            raise ValueError("Event name must be 200 characters or fewer")
        return v

    @field_validator("start_date", "end_date", check_fields=False)
    @classmethod
    def _dates(cls, v):
        return v if v is None else normalize_event_datetime(v)

    @field_validator("status", check_fields=False)
    @classmethod
    def _status(cls, v):
        if v is None:
            return v
        match = next((s for s in EVENT_STATUSES if s.lower() == str(v).strip().lower()), None)
        if not match:
            raise ValueError(f"Status must be one of: {', '.join(EVENT_STATUSES)}")
        return match

    @field_validator("category", "location", "description", check_fields=False)
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("volunteers_needed", check_fields=False)
    @classmethod
    def _needed(cls, v):
        if v is not None and v < 0:
            raise ValueError("Volunteer requirement cannot be negative")
        return v

    @model_validator(mode="after")
    def _date_order(self):
        start = getattr(self, "start_date", None)
        end = getattr(self, "end_date", None)
        if start and end and end < start:
            raise ValueError("End must be after start")
        return self


class EventBase(EventFields):
    name: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    status: Optional[str] = "Active"
    category: Optional[str] = ""
    is_featured: Optional[bool] = False
    volunteers_needed: Optional[int] = 0

class EventCreate(EventBase):
    pass

class EventUpdate(EventFields):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    is_featured: Optional[bool] = None
    volunteers_needed: Optional[int] = None

class EventOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    status: Optional[str] = "Active"
    category: Optional[str] = ""
    image_url: Optional[str] = ""
    is_featured: Optional[bool] = False
    volunteers_needed: Optional[int] = 0
    created_at: datetime
    # Computed from shifts / assignments (see crud.event_summary)
    volunteers_assigned: int = 0
    volunteer_target: int = 0
    shift_count: int = 0
    open_positions: int = 0
    zone_count: int = 0
    role_count: int = 0
    model_config = ConfigDict(from_attributes=True)

class EventCategoryOut(BaseModel):
    name: str
    event_count: int


# --- Zone Schemas ---
class ZoneBase(BaseModel):
    name: str
    description: Optional[str] = ""

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        v = (v or "").strip()
        if not v:
            raise ValueError("Zone name is required")
        return v

class ZoneCreate(ZoneBase):
    pass

class ZoneOut(ZoneBase):
    id: int
    event_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Role Schemas ---
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = ""
    required_skill: Optional[str] = ""
    needed_count: Optional[int] = 5

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        v = (v or "").strip()
        if not v:
            raise ValueError("Role name is required")
        return v

class RoleCreate(RoleBase):
    event_id: int

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    required_skill: Optional[str] = None
    needed_count: Optional[int] = None

class RoleOut(RoleBase):
    id: int
    event_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Volunteer Schemas ---
class VolunteerBase(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = ""
    skills: Optional[str] = ""
    emergency_contact: Optional[str] = ""
    notes: Optional[str] = ""
    preferences: Optional[str] = ""

class VolunteerCreate(VolunteerBase):
    pass

class VolunteerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[str] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None
    preferences: Optional[str] = None
    status: Optional[str] = None

class AttendanceRecordOut(BaseModel):
    id: int
    volunteer_id: int
    check_in_time: str
    check_out_time: Optional[str] = None
    hours_worked: float = 0.0
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AssignedShiftSummary(BaseModel):
    assignment_id: int
    shift_id: int
    title: str
    zone: str
    start_time: str
    end_time: str
    status: str

# --- Volunteer Availability Schemas ---
class AvailabilityBase(BaseModel):
    day_of_week: str
    start_time: str
    end_time: str

class AvailabilityCreate(AvailabilityBase):
    pass

class AvailabilityOut(AvailabilityBase):
    id: int
    volunteer_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ContactDetailsOut(BaseModel):
    email: str
    phone: Optional[str] = ""
    emergency_contact: Optional[str] = ""

class VolunteerOut(VolunteerBase):
    id: int
    name: Optional[str] = None
    status: str
    current_status: Optional[str] = None
    availability: Optional[str] = "Available"
    preferences: Optional[str] = ""
    contact_details: Optional[ContactDetailsOut] = None
    total_hours_worked: float = 0.0
    completed_shifts: int = 0
    no_shows: int = 0
    dropouts: int = 0
    reliability_score: float = 10.0
    availability_slots: List[AvailabilityOut] = []
    current_assigned_shifts: List[AssignedShiftSummary] = []
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class VolunteerDetailOut(VolunteerOut):
    attendance_history: List[AttendanceRecordOut] = []

class CheckInResponse(BaseModel):
    volunteer_id: int
    volunteer_name: str
    name: Optional[str] = None
    check_in_time: str
    status: str
    message: str

class CheckOutResponse(BaseModel):
    volunteer_id: int
    volunteer_name: str
    name: Optional[str] = None
    check_in_time: str
    check_out_time: str
    hours_worked: float
    total_hours_worked: float
    status: str
    message: str


# --- Shift Schemas ---
class ShiftBase(BaseModel):
    title: str
    date: Optional[str] = "2026-10-02"
    start_time: Optional[str] = ""
    end_time: Optional[str] = ""
    zone: Optional[str] = "Main Zone"
    required_skill: Optional[str] = ""
    mandatory_skill: Optional[str] = ""
    optional_skill: Optional[str] = ""
    capacity: Optional[int] = 2

class ShiftCreate(ShiftBase):
    event_id: int
    role_id: Optional[int] = None

class ShiftAssignmentOut(BaseModel):
    id: int
    shift_id: int
    volunteer_id: int
    status: str
    assignment_status: Optional[str] = "ASSIGNED"
    assigned_at: datetime
    no_show_at: Optional[datetime] = None
    dropout_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    volunteer: Optional[VolunteerOut] = None
    model_config = ConfigDict(from_attributes=True)

class CoverageOut(BaseModel):
    required_count: int
    assigned_count: int
    coverage_percentage: float
    coverage_gap: int
    coverage_status: str

class ShiftOut(ShiftBase):
    id: int
    event_id: int
    role_id: Optional[int] = None
    created_at: datetime
    assignments: List[ShiftAssignmentOut] = []
    role: Optional[RoleOut] = None
    coverage: Optional[CoverageOut] = None
    day_of_week: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class AssignShiftRequest(BaseModel):
    shift_id: int
    volunteer_id: int

class ShiftSuggestionOut(BaseModel):
    volunteer_id: int
    volunteer_name: str
    matched_skills: List[str] = []
    availability: str
    conflict_status: str
    current_workload: float
    score: float
    reason: str
    score_breakdown: Optional[dict] = None
    hard_constraints: Optional[dict] = None

class AutoAssignRequest(BaseModel):
    shift_id: Optional[int] = None
    event_id: Optional[int] = None

class DropoutRequest(BaseModel):
    shift_id: int
    volunteer_id: int

class RebalanceRequest(BaseModel):
    event_id: Optional[int] = None
    apply: Optional[bool] = False

class RebalanceAcceptRequest(BaseModel):
    volunteer_id: int
    from_shift_id: Optional[int] = None
    to_shift_id: Optional[int] = None
    source_shift_id: Optional[int] = None
    target_shift_id: Optional[int] = None


# --- Task Schemas ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = ""
    zone: str = "General"
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    status: Optional[str] = "OPEN"  # OPEN, IN_PROGRESS, RESOLVED
    assigned_volunteer_id: Optional[int] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    zone: str
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    status: Optional[str] = "OPEN"
    assigned_volunteer_id: Optional[int] = None
    event_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    zone: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_volunteer_id: Optional[int] = None

class TaskOut(BaseModel):
    id: int
    event_id: Optional[int] = None
    title: str
    description: Optional[str] = ""
    zone: str
    priority: str
    status: str
    assigned_volunteer_id: Optional[int] = None
    assigned_volunteer: Optional[VolunteerOut] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_time: Optional[str] = None
    updated_time: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# --- Issue / Incident Schemas ---
class IssueBase(BaseModel):
    title: str
    description: Optional[str] = ""
    zone: Optional[str] = "General"
    issue_type: str  # MEDICAL, CROWD_SURGE, MISSING_EQUIPMENT, SECURITY, OTHER
    priority: Optional[str] = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    status: Optional[str] = "OPEN"  # OPEN, ACKNOWLEDGED, RESOLVED
    assigned_coordinator: Optional[str] = None
    event_id: Optional[int] = None

class IssueCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    zone: Optional[str] = "General"
    issue_type: str
    priority: Optional[str] = "MEDIUM"
    status: Optional[str] = "OPEN"
    assigned_coordinator: Optional[str] = None
    event_id: Optional[int] = None

class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    zone: Optional[str] = None
    issue_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_coordinator: Optional[str] = None

class IssueOut(BaseModel):
    id: int
    event_id: Optional[int] = None
    title: str
    description: Optional[str] = ""
    zone: str
    issue_type: str
    priority: str
    status: str
    assigned_coordinator: str
    original_assigned_coordinator: Optional[str] = None
    escalation_level: int = 0
    escalated_at: Optional[datetime] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    is_urgent: bool = False
    requires_attention: bool = False
    is_escalated: bool = False
    escalation_tier: str = "Zone Lead"
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def set_computed_fields(self):
        pri = (self.priority or "").upper()
        st = (self.status or "").upper()
        urgent = pri in ["CRITICAL", "HIGH"] and st == "OPEN"
        self.is_urgent = urgent
        self.requires_attention = urgent
        self.is_escalated = (self.escalation_level or 0) > 0
        self.escalation_tier = ESCALATION_TIER_NAMES.get(self.escalation_level or 0, "Event Director")
        return self

class EscalatedIssueOut(BaseModel):
    id: int
    title: str
    priority: str
    zone: str
    escalation_level: int
    original_assigned_coordinator: Optional[str] = None
    assigned_coordinator: str
    created_at: datetime
    escalated_at: Optional[datetime] = None
    status: str
    issue_type: str
    escalation_tier: str = "Zone Lead"
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def set_tier(self):
        self.escalation_tier = ESCALATION_TIER_NAMES.get(self.escalation_level or 0, "Event Director")
        return self


# --- Announcement Schemas ---
class AnnouncementBase(BaseModel):
    title: str
    content: Optional[str] = ""
    message: Optional[str] = ""
    target_type: Optional[str] = "EVERYONE"  # EVERYONE, VOLUNTEERS, COORDINATORS, ZONE
    target_value: Optional[str] = ""
    priority: Optional[str] = "General"
    author: Optional[str] = "Event Coordinator"

class AnnouncementCreate(AnnouncementBase):
    event_id: Optional[int] = None

class AnnouncementOut(AnnouncementBase):
    id: int
    event_id: Optional[int] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Escalation Schemas ---
class EscalationBase(BaseModel):
    zone: Optional[str] = "General"
    title: str
    description: Optional[str] = ""
    severity: Optional[str] = "Medium"
    reported_by: Optional[str] = "Staff"

class EscalationCreate(EscalationBase):
    event_id: int

class EscalationUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    zone: Optional[str] = None
    resolved_at: Optional[str] = None

class EscalationOut(EscalationBase):
    id: int
    event_id: int
    status: str
    created_at: datetime
    resolved_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class TimeInjectRequest(BaseModel):
    now: Optional[str] = None  # ISO format string


# --- Dashboard Schemas ---
class DashboardMetrics(BaseModel):
    total_events: int
    active_events: int = 0
    upcoming_events: int = 0
    active_event_id: Optional[int]
    active_event_name: Optional[str]
    total_volunteers: int
    checked_in_volunteers: int
    present_volunteers: Optional[int] = 0
    checked_out_volunteers: int
    registered_volunteers: int
    available_volunteers: Optional[int] = 0
    total_volunteer_hours: Optional[float] = 0.0
    total_shifts: int
    filled_shifts: int
    total_tasks: int
    open_tasks: Optional[int] = 0
    pending_tasks: int
    in_progress_tasks: int
    resolved_tasks: Optional[int] = 0
    done_tasks: int
    critical_high_open_tasks: Optional[int] = 0
    open_issues: Optional[int] = 0
    critical_issues: Optional[int] = 0
    high_priority_issues: Optional[int] = 0
    escalated_issues_count: Optional[int] = 0
    no_shows_count: Optional[int] = 0
    tasks_in_progress: Optional[int] = 0
    urgent_issues: Optional[List[dict]] = []
    escalated_issues: Optional[List[dict]] = []
    active_escalations: int
    critical_escalations: int
    coverage_gaps_count: Optional[int] = 0
    understaffed_shifts_count: Optional[int] = 0
    overstaffed_shifts_count: Optional[int] = 0
    understaffed_zones: Optional[List[str]] = []
    overstaffed_zones: Optional[List[str]] = []
    rebalancing_suggestions: Optional[List[dict]] = []
    replacement_needed_shifts: Optional[List[dict]] = []
    zones_crowd_summary: List[dict]
