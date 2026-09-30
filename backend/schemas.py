from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

# --- Event Schemas ---
class EventBase(BaseModel):
    name: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    status: Optional[str] = "Active"

class EventCreate(EventBase):
    pass

class EventOut(EventBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Role Schemas ---
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = ""
    required_skill: Optional[str] = ""
    needed_count: Optional[int] = 5

class RoleCreate(RoleBase):
    event_id: int

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

class VolunteerCreate(VolunteerBase):
    pass

class VolunteerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[str] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class VolunteerOut(VolunteerBase):
    id: int
    status: str
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Shift Schemas ---
class ShiftBase(BaseModel):
    title: str
    start_time: Optional[str] = ""
    end_time: Optional[str] = ""
    zone: Optional[str] = "Main Zone"
    required_skill: Optional[str] = ""
    capacity: Optional[int] = 2

class ShiftCreate(ShiftBase):
    event_id: int
    role_id: Optional[int] = None

class ShiftAssignmentOut(BaseModel):
    id: int
    shift_id: int
    volunteer_id: int
    status: str
    assigned_at: datetime
    volunteer: Optional[VolunteerOut] = None
    model_config = ConfigDict(from_attributes=True)

class ShiftOut(ShiftBase):
    id: int
    event_id: int
    role_id: Optional[int] = None
    created_at: datetime
    assignments: List[ShiftAssignmentOut] = []
    role: Optional[RoleOut] = None
    model_config = ConfigDict(from_attributes=True)

class AssignShiftRequest(BaseModel):
    shift_id: int
    volunteer_id: int


# --- Task Schemas ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = ""
    zone: Optional[str] = "General"
    priority: Optional[str] = "Medium"
    status: Optional[str] = "todo"
    assigned_volunteer_id: Optional[int] = None

class TaskCreate(TaskBase):
    event_id: int

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    zone: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_volunteer_id: Optional[int] = None

class TaskOut(TaskBase):
    id: int
    event_id: int
    created_at: datetime
    updated_at: datetime
    assigned_volunteer: Optional[VolunteerOut] = None
    model_config = ConfigDict(from_attributes=True)


# --- Announcement Schemas ---
class AnnouncementBase(BaseModel):
    title: str
    content: str
    priority: Optional[str] = "General"
    author: Optional[str] = "Event Coordinator"

class AnnouncementCreate(AnnouncementBase):
    event_id: int

class AnnouncementOut(AnnouncementBase):
    id: int
    event_id: int
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


# --- Dashboard Schemas ---
class DashboardMetrics(BaseModel):
    total_events: int
    active_event_id: Optional[int]
    active_event_name: Optional[str]
    total_volunteers: int
    checked_in_volunteers: int
    checked_out_volunteers: int
    registered_volunteers: int
    total_shifts: int
    filled_shifts: int
    total_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    done_tasks: int
    active_escalations: int
    critical_escalations: int
    zones_crowd_summary: List[dict]
