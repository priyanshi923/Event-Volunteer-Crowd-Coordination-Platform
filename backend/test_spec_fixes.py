"""
Regression tests for the final.md specification fixes:
skill token matching, fairness formula, rebalance transfers, dropout guards,
scoped check-in, no-show date guard, escalation tiers, announcement audiences.
"""
import sys
# Standardize UTF-8 stdout so checkmarks print on Windows cp1252 consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import datetime
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
import models
import crud
import assignment_engine

client = TestClient(app)


def test_spec_fixes():
    print("=" * 60)
    print("RUNNING FINAL.MD SPEC FIX REGRESSION TESTS")
    print("=" * 60)
    assert client.post("/api/seed?force=true").status_code == 200
    db = SessionLocal()
    try:
        # 1. Skill matching: exact or token, no accidental substrings
        assert assignment_engine.skill_matches("First Aid", "CPR, First Aid Certified")
        assert assignment_engine.skill_matches("cpr", "CPR/AED")
        assert not assignment_engine.skill_matches("Aid", "Paid Parking")
        assert not assignment_engine.skill_matches("First Aid", "Crowd Control")
        print("  [PASS] Mandatory skill exact/token matching")

        # 2. Fairness = 20 - 2.5 * current_hours
        shift = db.query(models.Shift).filter(models.Shift.title.like("Medical%")).first()
        priya = db.query(models.Volunteer).filter_by(email="priya.sharma@example.com").first()
        ev = assignment_engine.evaluate_volunteer_for_shift(priya, shift, db)
        expected = max(0.0, round(20.0 - 2.5 * ev["current_workload"], 1))
        assert ev["score_breakdown"]["workload_fairness"] == expected, ev["score_breakdown"]
        print(f"  [PASS] Fairness formula ({ev['current_workload']}h -> {expected} pts)")

        # 3. Volunteer statuses use Available / Checked In / Checked Out
        statuses = {v["status"] for v in client.get("/api/volunteers").json()}
        assert statuses <= {"Available", "Checked In", "Checked Out"}, statuses
        print(f"  [PASS] Volunteer statuses: {sorted(statuses)}")

        # 4. Shifts expose day_of_week derived from date
        shifts = client.get("/api/events/1/shifts").json()
        assert shifts[0]["day_of_week"] == "Friday", shifts[0]["day_of_week"]
        print("  [PASS] Shift day_of_week derived from date")

        # 5. Rebalance only draws from surplus shifts, and an accepted move is not a dropout
        gate = db.query(models.Shift).filter(models.Shift.title.like("Morning Gate%")).first()
        stage = db.query(models.Shift).filter(models.Shift.title.like("Main Stage%")).first()
        zoe = db.query(models.Volunteer).filter_by(email="zoe.m@example.com").first()
        extra = db.query(models.Volunteer).filter_by(email="jamal.w@example.com").first()
        # Gate has capacity 3 with Alex + Jamal; add Zoe and a 4th to create a surplus of 1
        liam = db.query(models.Volunteer).filter_by(email="liam.oc@example.com").first()
        for v in (zoe, liam):
            assert client.post("/api/shifts/assign", json={"shift_id": gate.id, "volunteer_id": v.id}).status_code == 200
        plan = client.post("/api/assignments/rebalance", json={"event_id": 1}).json()
        gate_moves = [s for s in plan["suggestions"] if s["from_shift_id"] == gate.id]
        assert len(gate_moves) <= 1, "Must not move more volunteers than the source surplus"
        for s in plan["suggestions"]:
            src = db.query(models.Shift).get(s["from_shift_id"])
            db.refresh(src)
            cov = assignment_engine.calculate_coverage(src)
            assert cov["assigned_count"] > cov["required_count"], "Source shift must be overstaffed"
        assert gate_moves, "Expected a suggestion moving the gate surplus to a deficit shift"
        move = gate_moves[0]
        r = client.post("/api/assignments/rebalance/accept", json={
            "volunteer_id": move["volunteer_id"], "from_shift_id": move["from_shift_id"], "to_shift_id": move["to_shift_id"]})
        assert r.status_code == 200, r.text
        moved = client.get(f"/api/volunteers/{move['volunteer_id']}").json()
        assert moved["dropouts"] == 0, "Rebalance transfer must not count as a dropout"
        print(f"  [PASS] Surplus-only rebalance; transfer of {move['volunteer_name']} recorded no dropout")

        # 6. Dropout for a volunteer not on the shift is rejected (no fabricated dropout)
        r = client.post("/api/assignments/dropout", json={"shift_id": stage.id, "volunteer_id": extra.id})
        if extra.id not in {a.volunteer_id for a in stage.assignments}:
            assert r.status_code == 404, r.text
        print("  [PASS] Dropout requires an active assignment")

        # 7. Check-in applies to one shift only; checkout completes just that one
        marcus = db.query(models.Volunteer).filter_by(email="marcus.v@example.com").first()
        hydration = db.query(models.Shift).filter(models.Shift.title.like("Hydration%")).first()
        client.post(f"/api/volunteers/{marcus.id}/check-out")
        client.post("/api/shifts/assign", json={"shift_id": hydration.id, "volunteer_id": marcus.id})
        assert client.post(f"/api/volunteers/{marcus.id}/check-in").status_code == 200
        db.expire_all()
        checked = [a for a in marcus.shift_assignments if a.assignment_status == "CHECKED_IN"]
        assert len(checked) == 1, f"Expected exactly one checked-in assignment, got {len(checked)}"
        assert checked[0].shift.start_time == "08:00", "Earliest upcoming shift should be checked into"
        assert client.post(f"/api/volunteers/{marcus.id}/check-out").status_code == 200
        db.expire_all()
        still_assigned = [a for a in marcus.shift_assignments if a.shift_id == hydration.id]
        assert still_assigned[0].assignment_status == "ASSIGNED", "Later shift must stay assigned"
        print("  [PASS] Check-in/out scoped to a single shift")

        # 8. No-show: same weekday a week later must not retroactively flag the shift
        week_later = datetime.datetime(2026, 10, 9, 8, 30)  # Friday, shifts are on 2026-10-02
        assert crud.check_no_shows(db, now=week_later) == []
        on_day = datetime.datetime(2026, 10, 2, 10, 20)
        flagged = crud.check_no_shows(db, now=on_day)
        assert flagged, "Expected no-shows within the shift window on the shift date"
        assert crud.check_no_shows(db, now=on_day) == [], "Repeated passes must not re-flag"
        print(f"  [PASS] No-show date guard ({len(flagged)} flagged on shift day, none a week later)")

        # 9. Escalation tiers
        issue = client.post("/api/issues", json={"title": "Tier test", "issue_type": "SECURITY", "priority": "CRITICAL", "zone": "North Gate"}).json()
        assert issue["escalation_tier"] == "Zone Lead"
        t0 = db.query(models.Issue).get(issue["id"]).created_at
        names = []
        for n in range(1, 4):
            crud.check_issue_escalations(db, now=t0 + datetime.timedelta(minutes=2 * n, seconds=n))
            names.append(client.get(f"/api/issues/{issue['id']}").json()["escalation_tier"])
        assert names == ["Sector Supervisor", "Head of Operations", "Event Director"], names
        print(f"  [PASS] Escalation hierarchy: Zone Lead -> {' -> '.join(names)}")

        # 10. Announcement audiences and volunteer-scoped feed
        for t in ("VOLUNTEERS", "COORDINATORS"):
            r = client.post("/api/announcements", json={"title": f"{t} only", "message": "x", "target_type": t})
            assert r.status_code == 201 and r.json()["target_type"] == t, r.text
        r = client.post("/api/announcements", json={"title": "Zone", "message": "x", "target_type": "ZONE", "target_value": "Medical Tent"})
        assert r.status_code == 201
        assert client.post("/api/announcements", json={"title": "Bad", "target_type": "ZONE"}).status_code == 400
        feed = {a["title"] for a in client.get("/api/announcements", params={"event_id": 1, "volunteer_id": priya.id}).json()}
        assert "VOLUNTEERS only" in feed and "Zone" in feed, feed
        assert "COORDINATORS only" not in feed
        assert not any(t.startswith("Issue Escalated") or t.startswith("No-Show Alert") for t in feed), "System alerts are coordinator-only"
        print("  [PASS] Announcement audiences and volunteer feed filtering")
    finally:
        db.close()

    print("\nALL SPEC FIX REGRESSION TESTS PASSED")


if __name__ == "__main__":
    test_spec_fixes()
