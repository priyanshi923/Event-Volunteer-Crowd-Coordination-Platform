import sys
# Standardize UTF-8 stdout so checkmarks print on Windows cp1252 consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import datetime
from fastapi.testclient import TestClient
from main import app, init_db
from database import SessionLocal
import models
import crud
import assignment_engine


def _get_or_create_volunteer(db, email, full_name, skills, status="Active"):
    """Return existing volunteer by email or create a fresh one (idempotent)."""
    vol = db.query(models.Volunteer).filter_by(email=email).first()
    if not vol:
        vol = models.Volunteer(full_name=full_name, email=email, skills=skills, status=status)
        db.add(vol)
        db.commit()
        db.refresh(vol)
    else:
        vol.skills = skills
        vol.status = status
        db.commit()
    return vol


def run_enhancement_tests():
    init_db()
    client = TestClient(app)
    db = SessionLocal()

    print("==================================================")
    print("RUNNING FINAL ENHANCEMENT TEST SUITE (TESTS 1 - 10)")
    print("==================================================")

    # -------------------------------------------------------------------------
    # TEST 1: Availability matching
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: Availability Matching ---")
    # Clean test data if needed
    vol_avail = db.query(models.Volunteer).filter_by(email="avail_test@example.com").first()
    if not vol_avail:
        vol_avail = models.Volunteer(
            full_name="Avail Test Vol",
            email="avail_test@example.com",
            skills="First Aid,CPR",
            status="Active"
        )
        db.add(vol_avail)
        db.commit()
        db.refresh(vol_avail)

    # Clear previous test slots
    db.query(models.VolunteerAvailability).filter_by(volunteer_id=vol_avail.id).delete()
    # Add Friday 09:00 - 17:00 slot
    slot_fri = models.VolunteerAvailability(
        volunteer_id=vol_avail.id,
        day_of_week="Friday",
        start_time="09:00",
        end_time="17:00"
    )
    db.add(slot_fri)
    db.commit()

    # Friday shift 10:00 - 14:00 (2026-10-02 is a Friday)
    shift_fri = models.Shift(
        event_id=1,
        title="Friday Midday",
        zone="Main Stage",
        date="2026-10-02", # Friday
        start_time="10:00",
        end_time="14:00",
        capacity=2,
        required_skill="CPR"
    )
    # Saturday shift 10:00 - 14:00 (2026-10-03 is a Saturday)
    shift_sat = models.Shift(
        event_id=1,
        title="Saturday Shift",
        zone="Main Stage",
        date="2026-10-03", # Saturday
        start_time="10:00",
        end_time="14:00",
        capacity=2,
        required_skill="CPR"
    )

    h_fri, r_fri, msg_fri = assignment_engine.check_hard_constraints(vol_avail, shift_fri, db)
    assert h_fri is True, f"Volunteer should be eligible for Friday shift within slot, but failed: {msg_fri}"
    assert r_fri["availability_passed"] is True

    h_sat, r_sat, msg_sat = assignment_engine.check_hard_constraints(vol_avail, shift_sat, db)
    assert h_sat is False, "Volunteer should NOT be eligible for Saturday shift without slot"
    assert r_sat["availability_passed"] is False

    # Unconstrained volunteer (no slots)
    vol_unconstrained = _get_or_create_volunteer(db, "unconstrained_test@example.com", "Unconstrained Vol", "CPR")

    h_uncon_fri, r_uncon_fri, _ = assignment_engine.check_hard_constraints(vol_unconstrained, shift_fri, db)
    h_uncon_sat, r_uncon_sat, _ = assignment_engine.check_hard_constraints(vol_unconstrained, shift_sat, db)
    assert h_uncon_fri is True and r_uncon_fri["availability_passed"] is True
    assert h_uncon_sat is True and r_uncon_sat["availability_passed"] is True
    print("  [PASS] Availability matching verified: slot match passed, wrong day rejected, unconstrained accepted.")

    # -------------------------------------------------------------------------
    # TEST 2: Mandatory vs. Optional Skills
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: Mandatory vs. Optional Skills ---")
    vol_fa_only  = _get_or_create_volunteer(db, "fa_only@example.com",     "FA Only Vol",     "First Aid")
    vol_cpr_only = _get_or_create_volunteer(db, "cpr_only@example.com",    "CPR Only Vol",    "CPR")
    vol_both     = _get_or_create_volunteer(db, "both_skills@example.com", "Both Skills Vol", "CPR,Bilingual")

    shift_cpr_mand = models.Shift(
        event_id=1,
        title="CPR Mandatory Shift",
        zone="Medical Tent",
        start_time="09:00",
        end_time="12:00",
        capacity=2,
        required_skill="CPR",
        mandatory_skill="CPR",
        optional_skill="Bilingual"
    )

    # First Aid volunteer lacks mandatory CPR -> rejected
    h_fa, r_fa, _ = assignment_engine.check_hard_constraints(vol_fa_only, shift_cpr_mand, db)
    assert h_fa is False and r_fa["mandatory_skill_passed"] is False, "Volunteer without mandatory CPR must fail hard constraints"

    # CPR only volunteer passes hard constraints
    h_cpr, r_cpr, _ = assignment_engine.check_hard_constraints(vol_cpr_only, shift_cpr_mand, db)
    assert h_cpr is True and r_cpr["mandatory_skill_passed"] is True

    # Score comparison: CPR + Bilingual vs CPR only
    eval_cpr_only = assignment_engine.evaluate_volunteer_for_shift(vol_cpr_only, shift_cpr_mand, db)
    eval_both = assignment_engine.evaluate_volunteer_for_shift(vol_both, shift_cpr_mand, db)

    assert eval_both["score_breakdown"]["skill_match"] > eval_cpr_only["score_breakdown"]["skill_match"], \
        f"Volunteer with optional skill should score higher: {eval_both['score']} vs {eval_cpr_only['score']}"
    assert eval_both["score"] > eval_cpr_only["score"]
    print(f"  [PASS] Mandatory skill verified: CPR-only: {eval_cpr_only['score']}, CPR+Bilingual: {eval_both['score']}")

    # -------------------------------------------------------------------------
    # TEST 3: No-Show Grace Period (15m) + Duplicate Notification Protection
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: No-Show Grace Period (15m) ---")
    today_str = datetime.date.today().isoformat()

    vol_noshow = _get_or_create_volunteer(db, "noshow_cand@example.com", "No Show Candidate", "Security")

    # Clean up any leftover no-show test shifts from previous runs
    for os_ in db.query(models.Shift).filter(
        models.Shift.title == "No-Show Test Shift",
        models.Shift.date == today_str
    ).all():
        db.query(models.ShiftAssignment).filter_by(shift_id=os_.id).delete()
        db.delete(os_)
    db.commit()

    shift_noshow = models.Shift(
        event_id=1,
        title="No-Show Test Shift",
        zone="North Gate",
        date=today_str,
        start_time="09:00",
        end_time="13:00",
        capacity=1,
        required_skill="Security"
    )
    db.add(shift_noshow)
    db.commit()
    db.refresh(shift_noshow)

    vol_noshow.status = "Active"
    db.commit()

    assign_noshow = models.ShiftAssignment(
        shift_id=shift_noshow.id,
        volunteer_id=vol_noshow.id,
        status="Assigned",
        assignment_status="ASSIGNED"
    )
    db.add(assign_noshow)
    db.commit()

    # Time T1 = 09:10 (10 min after shift start, within 15 min grace period)
    t1 = datetime.datetime.fromisoformat(f"{today_str}T09:10:00")
    res_t1 = crud.check_no_shows(db, now=t1)
    db.refresh(assign_noshow)
    assert assign_noshow.assignment_status == "ASSIGNED", "Volunteer must NOT be marked no-show at 09:10 (within 15m grace)"

    # Time T2 = 09:16 (16 min after shift start, past 15 min grace period)
    t2 = datetime.datetime.fromisoformat(f"{today_str}T09:16:00")
    res_t2 = crud.check_no_shows(db, now=t2)
    db.refresh(assign_noshow)
    assert assign_noshow.assignment_status == "NO_SHOW", f"Volunteer must be marked NO_SHOW at 09:16, got {assign_noshow.assignment_status}"
    assert assign_noshow.no_show_at is not None
    assert len(res_t2) >= 1, f"Expected at least 1 no-show detected, got {len(res_t2)}"

    # Shift coverage should drop
    db.refresh(shift_noshow)
    cov = assignment_engine.calculate_coverage(shift_noshow)
    assert cov["assigned_count"] == 0
    assert cov["coverage_gap"] == 1

    # Check notification announcement created once (title format: "No-Show Alert: {name} for {shift}")
    initial_ann_count = db.query(models.Announcement).filter(
        models.Announcement.title.like("%No-Show Alert%")
    ).count()
    assert initial_ann_count >= 1, f"Expected at least 1 no-show announcement, got {initial_ann_count}"

    # Time T3 = 09:20 (next check must not duplicate announcement)
    t3 = datetime.datetime.fromisoformat(f"{today_str}T09:20:00")
    res_t3 = crud.check_no_shows(db, now=t3)
    later_ann_count = db.query(models.Announcement).filter(
        models.Announcement.title.like("%No-Show Alert%")
    ).count()
    assert later_ann_count == initial_ann_count, "Announcement must NOT be duplicated on subsequent checks"
    print("  [PASS] No-show grace period verified: ignored at 09:10, triggered at 09:16, no duplicate notification.")

    # -------------------------------------------------------------------------
    # TEST 4: Past Shift No-Show Protection
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: Past Shift No-Show Protection ---")
    yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

    vol_past = _get_or_create_volunteer(db, "past_vol@example.com", "Past Volunteer", "Registration")

    # Clean up leftover past test shifts
    for op in db.query(models.Shift).filter(
        models.Shift.title == "Yesterday Past Shift",
        models.Shift.date == yesterday_str
    ).all():
        db.query(models.ShiftAssignment).filter_by(shift_id=op.id).delete()
        db.delete(op)
    db.commit()

    shift_past = models.Shift(
        event_id=1,
        title="Yesterday Past Shift",
        zone="South Exit",
        date=yesterday_str,
        start_time="09:00",
        end_time="13:00",
        capacity=1,
        required_skill="Registration"
    )
    db.add(shift_past)
    db.commit()
    db.refresh(shift_past)

    assign_past = models.ShiftAssignment(
        shift_id=shift_past.id,
        volunteer_id=vol_past.id,
        status="Assigned",
        assignment_status="ASSIGNED"
    )
    db.add(assign_past)
    db.commit()

    # Run check today at 10:00: should NOT mark past shift assignment as no-show
    now_today = datetime.datetime.now()
    crud.check_no_shows(db, now=now_today)
    db.refresh(assign_past)
    assert assign_past.assignment_status == "ASSIGNED", "Completed/past shift must NOT be marked no-show"
    print("  [PASS] Past shift protected: yesterday's shift was not marked as no-show.")

    # -------------------------------------------------------------------------
    # TEST 5: Issue Escalation SLA & Maximum Level 3 Cap
    # -------------------------------------------------------------------------
    print("\n--- TEST 5: Issue Escalation SLA & Hierarchy ---")
    t0 = datetime.datetime(2026, 10, 1, 12, 0, 0)
    # Clean up previous test issue to allow idempotent re-runs
    db.query(models.Issue).filter_by(title="Critical Barricade Breach").delete()
    db.commit()
    issue_sla = models.Issue(
        title="Critical Barricade Breach",
        description="Gate collapse",
        zone="North Gate",
        issue_type="CROWD_SURGE",
        priority="CRITICAL",
        status="OPEN",
        assigned_coordinator="Security Coordinator",
        original_assigned_coordinator="Security Coordinator",
        escalation_level=0,
        created_at=t0
    )
    db.add(issue_sla)
    db.commit()
    db.refresh(issue_sla)

    # At T0 + 1m: Level 0 (Critical SLA is 2m)
    t_1m = t0 + datetime.timedelta(minutes=1)
    crud.check_issue_escalations(db, now=t_1m)
    db.refresh(issue_sla)
    assert issue_sla.escalation_level == 0

    # At T0 + 2m01s: Level 1 (Sector Supervisor)
    t_2m1s = t0 + datetime.timedelta(minutes=2, seconds=1)
    crud.check_issue_escalations(db, now=t_2m1s)
    db.refresh(issue_sla)
    assert issue_sla.escalation_level == 1, f"Expected Level 1, got {issue_sla.escalation_level}"
    assert issue_sla.assigned_coordinator == "Sector Supervisor"
    assert issue_sla.original_assigned_coordinator == "Security Coordinator"

    # At T0 + 4m02s: Level 2 (Head of Operations)
    t_4m2s = t0 + datetime.timedelta(minutes=4, seconds=2)
    crud.check_issue_escalations(db, now=t_4m2s)
    db.refresh(issue_sla)
    assert issue_sla.escalation_level == 2, f"Expected Level 2, got {issue_sla.escalation_level}"
    assert issue_sla.assigned_coordinator == "Head of Operations"

    # At T0 + 6m03s: Level 3 (Event Director)
    t_6m3s = t0 + datetime.timedelta(minutes=6, seconds=3)
    crud.check_issue_escalations(db, now=t_6m3s)
    db.refresh(issue_sla)
    assert issue_sla.escalation_level == 3, f"Expected Level 3, got {issue_sla.escalation_level}"
    assert issue_sla.assigned_coordinator == "Event Director"

    # At T0 + 8m: Still Level 3 (capped)
    t_8m = t0 + datetime.timedelta(minutes=8)
    crud.check_issue_escalations(db, now=t_8m)
    db.refresh(issue_sla)
    assert issue_sla.escalation_level == 3, "Escalation must be capped at Level 3"
    assert issue_sla.original_assigned_coordinator == "Security Coordinator"
    print("  [PASS] Issue SLA escalation verified: L0 -> L1 -> L2 -> L3 (capped), original coordinator preserved.")

    # -------------------------------------------------------------------------
    # TEST 6: Acknowledgement Stops Escalation
    # -------------------------------------------------------------------------
    print("\n--- TEST 6: Acknowledgement Stops Escalation ---")
    db.query(models.Issue).filter_by(title="Critical Medical Case").delete()
    db.commit()
    issue_ack = models.Issue(
        title="Critical Medical Case",
        description="Fainting attendee",
        zone="Main Stage",
        issue_type="MEDICAL",
        priority="CRITICAL",
        status="OPEN",
        assigned_coordinator="First Aid Coordinator",
        original_assigned_coordinator="First Aid Coordinator",
        escalation_level=0,
        created_at=t0
    )
    db.add(issue_ack)
    db.commit()
    db.refresh(issue_ack)

    # Acknowledge at T0 + 1m30s
    t_ack = t0 + datetime.timedelta(minutes=1, seconds=30)
    issue_ack.status = "ACKNOWLEDGED"
    issue_ack.acknowledged_at = t_ack
    db.commit()

    # Check at T0 + 5m (far past 2m SLA)
    t_5m = t0 + datetime.timedelta(minutes=5)
    crud.check_issue_escalations(db, now=t_5m)
    db.refresh(issue_ack)
    assert issue_ack.escalation_level == 0, f"Acknowledged issue must not escalate, got level {issue_ack.escalation_level}"
    print("  [PASS] Acknowledgement stops escalation: acknowledged issue stayed at Level 0.")

    # -------------------------------------------------------------------------
    # TEST 7: Zone Coverage Priority in Auto-Assignment
    # -------------------------------------------------------------------------
    print("\n--- TEST 7: Zone Coverage Priority ---")
    # Shift A: 0/3 assigned (critical need)
    shift_a = models.Shift(
        event_id=1,
        title="Zone 1 Unstaffed",
        zone="VIP Lounge",
        start_time="14:00",
        end_time="18:00",
        capacity=3,
        required_skill="Bilingual"
    )
    # Shift B: 2/3 assigned (already 67% staffed)
    shift_b = models.Shift(
        event_id=1,
        title="Zone 2 Partial",
        zone="Registration",
        start_time="14:00",
        end_time="18:00",
        capacity=3,
        required_skill="Bilingual"
    )
    db.add_all([shift_a, shift_b])
    db.commit()
    db.refresh(shift_a)
    db.refresh(shift_b)

    # Staff shift B with 2 dummy volunteers
    v_b1 = _get_or_create_volunteer(db, "b1@ex.com", "B1", "Bilingual")
    v_b2 = _get_or_create_volunteer(db, "b2@ex.com", "B2", "Bilingual")
    if not db.query(models.ShiftAssignment).filter_by(shift_id=shift_b.id, volunteer_id=v_b1.id).first():
        db.add(models.ShiftAssignment(shift_id=shift_b.id, volunteer_id=v_b1.id, status="Assigned"))
    if not db.query(models.ShiftAssignment).filter_by(shift_id=shift_b.id, volunteer_id=v_b2.id).first():
        db.add(models.ShiftAssignment(shift_id=shift_b.id, volunteer_id=v_b2.id, status="Assigned"))
    db.commit()

    # Candidate volunteer
    v_cand = _get_or_create_volunteer(db, "cand@ex.com", "Candidate", "Bilingual")

    score_a = assignment_engine.evaluate_volunteer_for_shift(v_cand, shift_a, db)
    score_b = assignment_engine.evaluate_volunteer_for_shift(v_cand, shift_b, db)

    # Shift A zone priority should be higher because coverage is 0% vs 67%
    assert score_a["score_breakdown"]["zone_priority"] > score_b["score_breakdown"]["zone_priority"], \
        f"0% covered zone must get higher zone priority: {score_a['score_breakdown']['zone_priority']} vs {score_b['score_breakdown']['zone_priority']}"
    print("  [PASS] Zone coverage priority verified: unstaffed zone awarded higher zone priority points.")

    # -------------------------------------------------------------------------
    # TEST 8: Scarcity-First Assignment Ordering
    # -------------------------------------------------------------------------
    print("\n--- TEST 8: Scarcity-First Global Assignment Ordering ---")
    # Shift X needs scarce skill "Paramedic" (only 1 vol)
    shift_x = models.Shift(
        event_id=1,
        title="Paramedic Shift",
        zone="Medical Tent",
        start_time="16:00",
        end_time="20:00",
        capacity=1,
        required_skill="Paramedic"
    )
    # Shift Y needs common skill "General Support" (many vols)
    shift_y = models.Shift(
        event_id=1,
        title="Common Support Shift",
        zone="Main Stage",
        start_time="10:00", # Starts earlier!
        end_time="14:00",
        capacity=1,
        required_skill="General Support"
    )
    db.add_all([shift_x, shift_y])
    db.commit()
    db.refresh(shift_x)
    db.refresh(shift_y)

    _get_or_create_volunteer(db, "para@ex.com", "Sole Paramedic", "Paramedic,General Support")
    _get_or_create_volunteer(db, "c1@ex.com",   "Comm1",          "General Support")
    _get_or_create_volunteer(db, "c2@ex.com",   "Comm2",          "General Support")

    # Calculate slack for both
    slack_x = assignment_engine.calculate_shift_slack(shift_x, db)
    slack_y = assignment_engine.calculate_shift_slack(shift_y, db)
    assert slack_x < slack_y, f"Shift X with scarce skill must have lower slack ({slack_x}) than Shift Y ({slack_y})"
    print(f"  [PASS] Scarcity slack verified: Shift X (Paramedic) slack={slack_x}, Shift Y (General Support) slack={slack_y}")

    # -------------------------------------------------------------------------
    # TEST 9: Workload Limit (8h Daily) & 30m Consecutive Break Rule
    # -------------------------------------------------------------------------
    print("\n--- TEST 9: Workload Limit & 30-Minute Break Rule ---")
    vol_worker = _get_or_create_volunteer(db, "worker_vol@example.com", "Worker Vol", "CPR")

    # Clean up any old 7h test shift for this volunteer on 2026-10-10
    for os7 in db.query(models.Shift).filter(
        models.Shift.title == "7h Morning",
        models.Shift.date == "2026-10-10"
    ).all():
        db.query(models.ShiftAssignment).filter_by(shift_id=os7.id, volunteer_id=vol_worker.id).delete()
        db.delete(os7)
    db.commit()

    # Assign 7h shift on 2026-10-10: 08:00 - 15:00
    shift_7h = models.Shift(
        event_id=1,
        title="7h Morning",
        zone="Main Stage",
        date="2026-10-10",
        start_time="08:00",
        end_time="15:00",
        capacity=1,
        required_skill="CPR"
    )
    db.add(shift_7h)
    db.commit()
    db.refresh(shift_7h)
    db.add(models.ShiftAssignment(shift_id=shift_7h.id, volunteer_id=vol_worker.id, status="Assigned"))
    db.commit()

    # Try assigning another 3h shift on same day: 16:00 - 19:00 (Total 10h > 8h limit)
    shift_3h = models.Shift(
        event_id=1,
        title="3h Evening",
        zone="Main Stage",
        date="2026-10-10",
        start_time="16:00",
        end_time="19:00",
        capacity=1,
        required_skill="CPR"
    )
    h_workload, r_workload, _ = assignment_engine.check_hard_constraints(vol_worker, shift_3h, db)
    assert h_workload is False and r_workload["workload_limit_passed"] is False, "Assignment exceeding 8h daily limit must be rejected"

    # Try shift with only 15m break: 15:15 - 17:00 (less than 30m after 15:00)
    shift_short_break = models.Shift(
        event_id=1,
        title="Short Break Shift",
        zone="Main Stage",
        date="2026-10-10",
        start_time="15:15",
        end_time="16:00",
        capacity=1,
        required_skill="CPR"
    )
    h_break, r_break, _ = assignment_engine.check_hard_constraints(vol_worker, shift_short_break, db)
    assert h_break is False and r_break["break_rule_passed"] is False, "Assignment violating 30m break rule must be rejected"
    print("  [PASS] Workload protection verified: 8h daily limit and 30m break rule enforced.")

    # -------------------------------------------------------------------------
    # TEST 10: Reliability Scoring
    # -------------------------------------------------------------------------
    print("\n--- TEST 10: Reliability Scoring ---")
    vol_new     = _get_or_create_volunteer(db, "brand_new@example.com", "Brand New Vol", "CPR")
    vol_stellar = _get_or_create_volunteer(db, "stellar@example.com",   "Stellar Vol",   "CPR")
    vol_flake   = _get_or_create_volunteer(db, "flaky@example.com",     "Flaky Vol",     "CPR")

    # Clear previous assignments for a clean reliability calculation
    for vol in [vol_new, vol_stellar, vol_flake]:
        db.query(models.ShiftAssignment).filter_by(volunteer_id=vol.id).delete()
    db.commit()

    # Simulate 5 completed shifts for stellar
    for i in range(5):
        s = models.Shift(event_id=1, title=f"Done {i}", zone="Main", start_time="09:00", end_time="11:00", capacity=1, required_skill="CPR")
        db.add(s)
        db.commit()
        db.add(models.ShiftAssignment(shift_id=s.id, volunteer_id=vol_stellar.id, status="Checked-Out", assignment_status="COMPLETED"))
    db.commit()

    # Simulate 1 completed, 2 no-shows for flaky
    s1 = models.Shift(event_id=1, title="Done Flake", zone="Main", start_time="09:00", end_time="11:00", capacity=1, required_skill="CPR")
    db.add(s1)
    db.commit()
    db.add(models.ShiftAssignment(shift_id=s1.id, volunteer_id=vol_flake.id, status="Checked-Out", assignment_status="COMPLETED"))

    s2 = models.Shift(event_id=1, title="NoShow 1", zone="Main", start_time="09:00", end_time="11:00", capacity=1, required_skill="CPR")
    s3 = models.Shift(event_id=1, title="NoShow 2", zone="Main", start_time="09:00", end_time="11:00", capacity=1, required_skill="CPR")
    db.add_all([s2, s3])
    db.commit()
    db.add(models.ShiftAssignment(shift_id=s2.id, volunteer_id=vol_flake.id, status="No-Show", assignment_status="NO_SHOW"))
    db.add(models.ShiftAssignment(shift_id=s3.id, volunteer_id=vol_flake.id, status="No-Show", assignment_status="NO_SHOW"))
    db.commit()

    rel_new = assignment_engine.calculate_reliability_score(vol_new, db)
    rel_stellar = assignment_engine.calculate_reliability_score(vol_stellar, db)
    rel_flake = assignment_engine.calculate_reliability_score(vol_flake, db)

    assert rel_new == 5.0, f"New volunteer should have neutral score 5.0, got {rel_new}"
    assert rel_stellar == 10.0, f"Stellar volunteer should have score 10.0, got {rel_stellar}"
    assert rel_flake < 3.0, f"Flaky volunteer with 2 no-shows should score < 3.0, got {rel_flake}"
    print(f"  [PASS] Reliability scoring verified: New: {rel_new}/10, Stellar: {rel_stellar}/10, Flaky: {rel_flake}/10")

    db.close()
    print("\n==================================================")
    print("ALL 10 ENHANCEMENT TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================")

def test_all_enhancements():
    """Pytest test case executing all 10 algorithmic and SLA enhancement tests."""
    run_enhancement_tests()

if __name__ == "__main__":
    run_enhancement_tests()
