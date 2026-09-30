"""
Assignment Engine for Event Volunteer & Crowd Coordination Platform.

Rule-based volunteer assignment engine implementing:
1. Required skills match (Weight: 40)
2. Availability check (Weight: 25)
3. Conflict detection for overlapping shifts (Weight: 20)
4. Preference bonus for role/zone (Weight: 10)
5. Workload fairness distribution (Weight: 5)
Total score = sum of applicable scores (out of 100).
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
import models

# ----------------- TIME & CONFLICT HELPERS -----------------

def parse_time_to_minutes(time_str: Optional[str]) -> Optional[int]:
    """Parse time string like '08:00', '14:30', '9:00', '8:00 AM' to minutes from midnight."""
    if not time_str:
        return None
    time_str = str(time_str).strip()
    is_pm = 'pm' in time_str.lower()
    is_am = 'am' in time_str.lower()
    cleaned = time_str.lower().replace('am', '').replace('pm', '').strip()
    parts = cleaned.split(':')
    if len(parts) >= 2:
        try:
            h = int(parts[0])
            m = int(parts[1])
            if is_pm and h < 12:
                h += 12
            elif is_am and h == 12:
                h = 0
            return h * 60 + m
        except ValueError:
            return None
    return None

def calculate_shift_duration_hours(start_str: Optional[str], end_str: Optional[str]) -> float:
    """Calculate the duration of a shift in hours."""
    m_s = parse_time_to_minutes(start_str)
    m_e = parse_time_to_minutes(end_str)
    if m_s is not None and m_e is not None:
        if m_e <= m_s:
            m_e += 24 * 60  # spans past midnight
        return max(0.5, round((m_e - m_s) / 60.0, 1))
    return 4.0  # default standard shift duration

def shifts_overlap(s1_start: str, s1_end: str, s2_start: str, s2_end: str) -> bool:
    """Determine if two shifts overlap in operational time."""
    m1_s = parse_time_to_minutes(s1_start)
    m1_e = parse_time_to_minutes(s1_end)
    m2_s = parse_time_to_minutes(s2_start)
    m2_e = parse_time_to_minutes(s2_end)

    if m1_s is None or m1_e is None or m2_s is None or m2_e is None:
        return False
    if m1_e <= m1_s:
        m1_e += 24 * 60
    if m2_e <= m2_s:
        m2_e += 24 * 60

    # Overlap occurs when max(start1, start2) < min(end1, end2)
    return max(m1_s, m2_s) < min(m1_e, m2_e)


# ----------------- COVERAGE CALCULATION -----------------

def calculate_coverage(shift: models.Shift) -> Dict[str, Any]:
    """
    Calculate coverage metrics for a shift:
    - required_count
    - assigned_count
    - coverage_percentage
    - coverage_gap
    - coverage_status (FULL, PARTIAL, CRITICAL)
    """
    required_count = int(shift.capacity or 1)
    active_assignments = [
        a for a in (shift.assignments or [])
        if a.status in ("Assigned", "Confirmed")
    ]
    assigned_count = len(active_assignments)

    if required_count > 0:
        coverage_percentage = round((assigned_count / required_count) * 100.0, 1)
    else:
        coverage_percentage = 100.0

    coverage_gap = max(0, required_count - assigned_count)

    if assigned_count >= required_count:
        coverage_status = "FULL"
    elif assigned_count > 0:
        coverage_status = "PARTIAL"
    else:
        coverage_status = "CRITICAL"

    return {
        "shift_id": shift.id,
        "title": shift.title,
        "required_count": required_count,
        "assigned_count": assigned_count,
        "coverage_percentage": coverage_percentage,
        "coverage_gap": coverage_gap,
        "coverage_status": coverage_status,
        "active_assignments": active_assignments
    }


# ----------------- VOLUNTEER WORKLOAD -----------------

def get_volunteer_workload(db: Session, volunteer_id: int) -> float:
    """
    Calculate the cumulative workload (actual worked hours from attendance records
    + upcoming assigned shift hours) to ensure workload fairness.
    """
    # 1. Actual hours completed from attendance sessions
    actual_records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.volunteer_id == volunteer_id
    ).all()
    actual_hours = sum(r.hours_worked or 0.0 for r in actual_records)

    # 2. Upcoming assigned shift hours
    assignments = db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.volunteer_id == volunteer_id,
        models.ShiftAssignment.status.in_(["Assigned", "Confirmed"])
    ).all()

    assigned_hours = 0.0
    for a in assignments:
        if a.shift:
            assigned_hours += calculate_shift_duration_hours(a.shift.start_time, a.shift.end_time)
        else:
            assigned_hours += 4.0

    return round(actual_hours + assigned_hours, 1)


# ----------------- RULE-BASED SCORING MODEL -----------------

def evaluate_volunteer_for_shift(
    volunteer: models.Volunteer,
    shift: models.Shift,
    db: Session,
    active_volunteer_shifts: Optional[List[models.Shift]] = None
) -> Dict[str, Any]:
    """
    Evaluate a volunteer for a specific shift using the 5 weighted rules:
    1. skill_match = 40
    2. availability = 25
    3. no_conflict = 20
    4. preference = 10
    5. workload_fairness = 5
    Total score = sum of applicable scores.
    """
    # 1. Skill Match (40 pts)
    required_skill = (shift.required_skill or "").strip().lower()
    volunteer_skills = [
        s.strip().lower() for s in (volunteer.skills or "").split(",") if s.strip()
    ]
    volunteer_skills_raw = (volunteer.skills or "").lower()

    matched_skills = []
    skill_score = 0.0

    if not required_skill or required_skill in ("general", "none"):
        skill_score = 40.0
        matched_skills.append("General Availability")
    else:
        # Check direct substring in skills string or tokens
        if required_skill in volunteer_skills_raw:
            skill_score = 40.0
            matched_skills.append(shift.required_skill)
        else:
            # Check individual tokens (e.g. "cpr", "first aid", "crowd", "security")
            req_tokens = required_skill.replace("/", " ").replace("-", " ").split()
            matched_tokens = [
                token for token in req_tokens
                if len(token) > 2 and any(token in s for s in volunteer_skills)
            ]
            if matched_tokens:
                skill_score = 30.0
                matched_skills.extend(matched_tokens)
            else:
                skill_score = 0.0

    has_required_skill = (skill_score > 0)

    # 2. Availability (25 pts)
    # Check if volunteer has dropped out of this specific shift
    dropped_out = db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.shift_id == shift.id,
        models.ShiftAssignment.volunteer_id == volunteer.id,
        models.ShiftAssignment.status == "Dropped Out"
    ).first() is not None

    is_checked_out = (volunteer.status == "Checked Out")

    if dropped_out:
        is_available = False
        availability_score = 0.0
        availability_status = "Unavailable (Dropped Out)"
    elif is_checked_out:
        is_available = False
        availability_score = 0.0
        availability_status = "Unavailable (Checked Out)"
    else:
        is_available = True
        availability_score = 25.0
        availability_status = "Available"

    # 3. Conflict Detection (20 pts)
    # Volunteer cannot be assigned to overlapping shifts
    if active_volunteer_shifts is None:
        other_assignments = db.query(models.ShiftAssignment).filter(
            models.ShiftAssignment.volunteer_id == volunteer.id,
            models.ShiftAssignment.shift_id != shift.id,
            models.ShiftAssignment.status.in_(["Assigned", "Confirmed"])
        ).all()
        other_shifts = [a.shift for a in other_assignments if a.shift]
    else:
        other_shifts = [s for s in active_volunteer_shifts if s.id != shift.id]

    has_conflict = False
    conflicting_shift_title = None

    for os in other_shifts:
        if shifts_overlap(shift.start_time, shift.end_time, os.start_time, os.end_time):
            has_conflict = True
            conflicting_shift_title = os.title
            break

    if has_conflict:
        conflict_score = 0.0
        conflict_status = f"Conflict with '{conflicting_shift_title}'"
        if is_available:
            availability_status = f"Busy ({conflict_status})"
    else:
        conflict_score = 20.0
        conflict_status = "No Conflict"
        if is_available:
            availability_status = "Available (Checked In)" if volunteer.status == "Checked In" else "Available"

    # 4. Preference (10 pts)
    # Volunteer preference check against zone or role
    notes_lower = (volunteer.notes or "").lower()
    zone_lower = (shift.zone or "").lower()
    role_name = (shift.role.name.lower() if shift.role and shift.role.name else "")

    has_preference = False
    if zone_lower and (zone_lower in notes_lower or zone_lower in volunteer_skills_raw):
        has_preference = True
    elif role_name and (role_name in notes_lower or role_name in volunteer_skills_raw):
        has_preference = True
    elif "prefer" in notes_lower and any(w in notes_lower for w in zone_lower.split()):
        has_preference = True

    preference_score = 10.0 if has_preference else 0.0

    # 5. Workload Fairness (5 pts)
    # Prefer volunteers with fewer assigned hours
    current_workload_hours = get_volunteer_workload(db, volunteer.id)
    # Max score 5 for 0 hours, decaying linearly
    workload_score = max(0.0, round(5.0 - (current_workload_hours * 0.5), 1))

    # Total Score
    total_score = round(
        skill_score + availability_score + conflict_score + preference_score + workload_score,
        1
    )

    # Human-readable Reason Generation
    reason_parts = []
    if has_required_skill:
        reason_parts.append(f"Skills matched ({shift.required_skill or 'General'})")
    else:
        reason_parts.append("Missing required specialized skills")

    if is_available:
        reason_parts.append("Fully available")
    else:
        reason_parts.append(availability_status)

    if not has_conflict:
        reason_parts.append("Zero schedule conflicts")
    else:
        reason_parts.append(conflict_status)

    if has_preference:
        reason_parts.append(f"Prefers zone '{shift.zone}'")

    reason_parts.append(f"Current workload: {current_workload_hours}h")

    reason = "; ".join(reason_parts)

    # Check overall eligibility for assignment:
    # Must be available and have NO time conflict; skill match contributes 40 points to score
    is_eligible = is_available and (not has_conflict)

    return {
        "volunteer_id": volunteer.id,
        "volunteer_name": volunteer.full_name,
        "skills": volunteer.skills or "",
        "matched_skills": matched_skills,
        "availability": availability_status,
        "is_available": is_available,
        "conflict_status": conflict_status,
        "has_conflict": has_conflict,
        "current_workload": current_workload_hours,
        "score": total_score,
        "score_breakdown": {
            "skill_match": skill_score,
            "availability": availability_score,
            "no_conflict": conflict_score,
            "preference": preference_score,
            "workload_fairness": workload_score
        },
        "reason": reason,
        "is_eligible": is_eligible
    }


# ----------------- TOP SUGGESTIONS (TOP 3) -----------------

def get_shift_suggestions(db: Session, shift_id: int, limit: int = 3) -> List[Dict[str, Any]]:
    """
    Get top eligible volunteer suggestions for a shift, sorted by rule-based score.
    """
    shift = db.query(models.Shift).filter(models.Shift.id == shift_id).first()
    if not shift:
        return []

    # Get already assigned volunteer IDs for this shift
    assigned_ids = {
        a.volunteer_id for a in (shift.assignments or [])
        if a.status in ("Assigned", "Confirmed")
    }

    all_volunteers = db.query(models.Volunteer).all()
    candidates = []

    for v in all_volunteers:
        if v.id in assigned_ids:
            continue
        eval_res = evaluate_volunteer_for_shift(v, shift, db)
        if not eval_res["is_available"]:
            continue
        candidates.append(eval_res)

    # Sort priority:
    # 1. No conflict (1 if no conflict else 0)
    # 2. Overall score descending
    # 3. Workload ascending (fewer hours first)
    candidates.sort(
        key=lambda x: (
            1 if not x["has_conflict"] else 0,
            x["score"],
            -x["current_workload"]
        ),
        reverse=True
    )
    return candidates[:limit]


# ----------------- AUTO-ASSIGNMENT ENGINE -----------------

def auto_assign_shift(db: Session, shift: models.Shift) -> Dict[str, Any]:
    """
    Automatically assign volunteers to a shift until required headcount is reached.
    Never assigns the same volunteer twice or to overlapping shifts.
    """
    cov_before = calculate_coverage(shift)
    needed = cov_before["coverage_gap"]

    if needed <= 0:
        return {
            "shift_id": shift.id,
            "title": shift.title,
            "assigned_new_count": 0,
            "assigned_volunteers": [],
            "coverage": cov_before
        }

    already_assigned_ids = {
        a.volunteer_id for a in (shift.assignments or [])
        if a.status in ("Assigned", "Confirmed")
    }

    all_volunteers = db.query(models.Volunteer).all()
    eligible_candidates = []

    for v in all_volunteers:
        if v.id in already_assigned_ids:
            continue
        eval_res = evaluate_volunteer_for_shift(v, shift, db)
        if eval_res["is_eligible"]:
            eligible_candidates.append((eval_res, v))

    # Sort descending by score
    eligible_candidates.sort(key=lambda item: (item[0]["score"], -item[0]["current_workload"]), reverse=True)

    assigned_vols = []
    count = 0

    for eval_res, vol in eligible_candidates:
        if count >= needed:
            break

        # Double check conflict in real-time in case assigned in this same batch
        realtime_eval = evaluate_volunteer_for_shift(vol, shift, db)
        if not realtime_eval["is_eligible"]:
            continue

        # Create or update assignment
        existing = db.query(models.ShiftAssignment).filter(
            models.ShiftAssignment.shift_id == shift.id,
            models.ShiftAssignment.volunteer_id == vol.id
        ).first()

        if existing:
            existing.status = "Assigned"
            existing.assigned_at = datetime.utcnow()
        else:
            assignment = models.ShiftAssignment(
                shift_id=shift.id,
                volunteer_id=vol.id,
                status="Assigned"
            )
            db.add(assignment)

        db.commit()
        count += 1
        assigned_vols.append({
            "volunteer_id": vol.id,
            "volunteer_name": vol.full_name,
            "score": eval_res["score"],
            "reason": eval_res["reason"]
        })

    # Refresh shift and recalculate coverage
    db.refresh(shift)
    cov_after = calculate_coverage(shift)

    return {
        "shift_id": shift.id,
        "title": shift.title,
        "assigned_new_count": count,
        "assigned_volunteers": assigned_vols,
        "coverage": cov_after
    }


def auto_assign_all_shifts(db: Session, event_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Automatically assign volunteers to all shifts (or all shifts in an event).
    Processes understaffed shifts prioritizing Critical shifts first.
    """
    query = db.query(models.Shift)
    if event_id:
        query = query.filter(models.Shift.event_id == event_id)
    shifts = query.all()

    # Sort shifts so CRITICAL (0 assigned) are assigned first, then PARTIAL, then by start time
    shifts_with_cov = [(s, calculate_coverage(s)) for s in shifts]
    shifts_with_cov.sort(
        key=lambda sc: (
            0 if sc[1]["coverage_status"] == "CRITICAL" else 1 if sc[1]["coverage_status"] == "PARTIAL" else 2,
            sc[1]["coverage_gap"]
        ),
        reverse=True
    )

    results = []
    for s, _ in shifts_with_cov:
        res = auto_assign_shift(db, s)
        results.append(res)

    return results


# ----------------- REBALANCE UNDERSTAFFED SHIFTS -----------------

def rebalance_assignments(db: Session, event_id: Optional[int] = None, apply: bool = False) -> Dict[str, Any]:
    """
    Identify:
    - Overstaffed shifts/zones (assigned_count > required_count)
    - Understaffed shifts/zones (coverage_gap > 0)
    Suggest moving a volunteer from an overstaffed area to an understaffed area when:
    - The volunteer is available.
    - The volunteer has no conflicting shift.
    - Their skills match the required role.
    - The source zone/shift remains adequately staffed (assigned - 1 >= required).
    Do NOT automatically move volunteers unless apply=True.
    """
    query = db.query(models.Shift)
    if event_id:
        query = query.filter(models.Shift.event_id == event_id)
    all_shifts = query.all()

    understaffed_shifts = []
    overstaffed_shifts = []

    # Map zones to calculate zone-level staffing
    zone_stats = {}

    for s in all_shifts:
        cov = calculate_coverage(s)
        z = s.zone or "General"
        if z not in zone_stats:
            zone_stats[z] = {"required": 0, "assigned": 0}
        zone_stats[z]["required"] += cov["required_count"]
        zone_stats[z]["assigned"] += cov["assigned_count"]

        if cov["coverage_gap"] > 0:
            understaffed_shifts.append((s, cov))
        elif cov["assigned_count"] > cov["required_count"]:
            overstaffed_shifts.append((s, cov))

    overstaffed_zones = [z for z, st in zone_stats.items() if st["assigned"] > st["required"]]
    understaffed_zones = [z for z, st in zone_stats.items() if st["assigned"] < st["required"]]

    # Candidate source shifts: prioritize strictly overstaffed shifts (assigned > required)
    candidate_sources = list(overstaffed_shifts)
    if not candidate_sources:
        # Fallback to fully staffed shifts with >= 2 volunteers where source zone has no deficit
        for s in all_shifts:
            cov = calculate_coverage(s)
            if cov["assigned_count"] >= 2 and s.zone not in understaffed_zones and cov["coverage_gap"] == 0:
                candidate_sources.append((s, cov))

    rebalance_suggestions = []

    for target_shift, target_cov in understaffed_shifts:
        needed = target_cov["coverage_gap"]
        if needed <= 0:
            continue

        for source_shift, source_cov in candidate_sources:
            if source_shift.id == target_shift.id:
                continue

            active_source_assignments = [
                a for a in (source_shift.assignments or [])
                if a.status in ("Assigned", "Confirmed")
            ]
            if len(active_source_assignments) <= 1:
                continue

            for asgn in active_source_assignments:
                candidate = asgn.volunteer
                if not candidate:
                    continue

                # Check eligibility without source shift's time window
                other_shifts = [
                    a.shift for a in (candidate.shift_assignments or [])
                    if a.shift and a.shift.id not in (source_shift.id, target_shift.id) and a.status in ("Assigned", "Confirmed")
                ]
                eval_res = evaluate_volunteer_for_shift(candidate, target_shift, db, other_shifts)

                if eval_res["is_eligible"]:
                    cur_target_pct = target_cov["coverage_percentage"]
                    cur_req = target_cov["required_count"]
                    new_target_assigned = target_cov["assigned_count"] + 1
                    new_target_pct = round((new_target_assigned / cur_req) * 100.0, 1) if cur_req > 0 else 100.0

                    source_req = source_cov["required_count"]
                    new_source_assigned = len(active_source_assignments) - 1
                    new_source_pct = round((new_source_assigned / source_req) * 100.0, 1) if source_req > 0 else 100.0

                    suggestion_text = f"Move {candidate.full_name} from {source_shift.zone} ({source_shift.title}) to {target_shift.zone} ({target_shift.title})"
                    improvement_text = f"Increases {target_shift.zone} coverage from {cur_target_pct}% to {new_target_pct}%, while {source_shift.zone} remains adequately staffed at {new_source_pct}%"

                    suggestion = {
                        "volunteer_id": candidate.id,
                        "volunteer_name": candidate.full_name,
                        "from_shift_id": source_shift.id,
                        "from_shift_title": source_shift.title,
                        "from_zone": source_shift.zone,
                        "to_shift_id": target_shift.id,
                        "to_shift_title": target_shift.title,
                        "to_zone": target_shift.zone,
                        "score": eval_res["score"],
                        "skills": candidate.skills or "",
                        "reason": f"{suggestion_text}. {improvement_text}",
                        "suggestion_text": suggestion_text,
                        "expected_coverage_improvement": improvement_text
                    }
                    rebalance_suggestions.append(suggestion)

                    if apply:
                        # Move volunteer
                        asgn.status = "Reassigned"
                        db.commit()
                        new_asgn = models.ShiftAssignment(
                            shift_id=target_shift.id,
                            volunteer_id=candidate.id,
                            status="Assigned",
                            assigned_at=datetime.utcnow()
                        )
                        db.add(new_asgn)
                        db.commit()

                    needed -= 1
                    if needed <= 0:
                        break
            if needed <= 0:
                break

    return {
        "understaffed_shifts_count": len(understaffed_shifts),
        "overstaffed_shifts_count": len(overstaffed_shifts),
        "understaffed_zones": understaffed_zones,
        "overstaffed_zones": overstaffed_zones,
        "suggestions_count": len(rebalance_suggestions),
        "applied": apply,
        "suggestions": rebalance_suggestions
    }


def apply_single_rebalance(
    db: Session,
    volunteer_id: int,
    from_shift_id: int,
    to_shift_id: int
) -> Dict[str, Any]:
    """
    Coordinator accepts a specific rebalancing suggestion to move a volunteer.
    Moves the volunteer and recalculates coverage for both shifts.
    """
    from_shift = db.query(models.Shift).filter(models.Shift.id == from_shift_id).first()
    to_shift = db.query(models.Shift).filter(models.Shift.id == to_shift_id).first()
    volunteer = db.query(models.Volunteer).filter(models.Volunteer.id == volunteer_id).first()

    if not from_shift or not to_shift or not volunteer:
        return {"error": "Shift or Volunteer not found"}

    # Find the active assignment in from_shift
    existing_from = db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.shift_id == from_shift_id,
        models.ShiftAssignment.volunteer_id == volunteer_id,
        models.ShiftAssignment.status.in_(["Assigned", "Confirmed"])
    ).first()

    if existing_from:
        existing_from.status = "Reassigned"
        db.commit()

    # Create or activate assignment in to_shift
    existing_to = db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.shift_id == to_shift_id,
        models.ShiftAssignment.volunteer_id == volunteer_id
    ).first()

    if existing_to:
        existing_to.status = "Assigned"
        existing_to.assigned_at = datetime.utcnow()
    else:
        new_asgn = models.ShiftAssignment(
            shift_id=to_shift_id,
            volunteer_id=volunteer_id,
            status="Assigned",
            assigned_at=datetime.utcnow()
        )
        db.add(new_asgn)
    db.commit()

    db.refresh(from_shift)
    db.refresh(to_shift)

    from_cov = calculate_coverage(from_shift)
    to_cov = calculate_coverage(to_shift)

    return {
        "message": f"Successfully moved '{volunteer.full_name}' from '{from_shift.title}' to '{to_shift.title}'.",
        "volunteer_id": volunteer_id,
        "volunteer_name": volunteer.full_name,
        "from_shift_id": from_shift.id,
        "to_shift_id": to_shift.id,
        "from_shift_coverage": from_cov,
        "to_shift_coverage": to_cov
    }


# ----------------- DROPOUT & REPLACEMENT -----------------

def handle_volunteer_dropout(
    db: Session,
    shift_id: int,
    volunteer_id: int
) -> Dict[str, Any]:
    """
    When an assigned volunteer drops out:
    - Mark the volunteer unavailable for that shift (status = 'Dropped Out').
    - Remove the active assignment.
    - Recalculate coverage and identify staffing gap.
    - Generate replacement suggestions (scored using existing assignment engine).
    """
    shift = db.query(models.Shift).filter(models.Shift.id == shift_id).first()
    if not shift:
        return {"error": "Shift not found"}

    volunteer = db.query(models.Volunteer).filter(models.Volunteer.id == volunteer_id).first()
    if not volunteer:
        return {"error": "Volunteer not found"}

    # Find the active assignment
    assignment = db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.shift_id == shift_id,
        models.ShiftAssignment.volunteer_id == volunteer_id,
        models.ShiftAssignment.status.in_(["Assigned", "Confirmed"])
    ).first()

    if assignment:
        assignment.status = "Dropped Out"
        db.commit()
        db.refresh(assignment)

    # Recalculate coverage
    db.refresh(shift)
    coverage = calculate_coverage(shift)

    # Generate top replacements
    replacements = get_shift_suggestions(db, shift_id, limit=5)

    affected_shift_data = {
        "id": shift.id,
        "title": shift.title,
        "zone": shift.zone,
        "start_time": shift.start_time,
        "end_time": shift.end_time,
        "required_skill": shift.required_skill,
        "capacity": shift.capacity
    }

    return {
        "message": f"Volunteer '{volunteer.full_name}' dropped out from shift '{shift.title}'. Marked unavailable.",
        "shift_id": shift_id,
        "shift_title": shift.title,
        "affected_shift": affected_shift_data,
        "volunteer_id": volunteer_id,
        "volunteer_name": volunteer.full_name,
        "required_headcount": coverage["required_count"],
        "current_assigned_headcount": coverage["assigned_count"],
        "coverage_percentage": coverage["coverage_percentage"],
        "coverage_gap": coverage["coverage_gap"],
        "coverage_status": coverage["coverage_status"],
        "coverage": coverage,
        "replacement_suggestions": replacements,
        "replacements": replacements
    }

