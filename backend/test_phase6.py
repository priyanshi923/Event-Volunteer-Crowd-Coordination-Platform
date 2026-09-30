import sys
from fastapi.testclient import TestClient
from main import app, init_db
from database import SessionLocal
import models

def test_phase6():
    init_db()
    client = TestClient(app)

    print("==================================================")
    print("TESTING PHASE 6: DROPOUT, REPLACEMENT & REBALANCING")
    print("==================================================")

    # 1. Reset / Seed clean state or get shifts
    r_shifts = client.get("/api/events/1/shifts")
    assert r_shifts.status_code == 200, f"Failed getting shifts: {r_shifts.text}"
    shifts = r_shifts.json()
    assert len(shifts) > 0, "No shifts found"
    target_shift = shifts[0]
    shift_id = target_shift["id"]
    capacity = target_shift["capacity"]
    print(f"  [PASS] Target shift #{shift_id}: '{target_shift['title']}' (Capacity: {capacity})")

    # 2. Auto-assign volunteers to ensure shift is staffed
    r_auto = client.post("/assignments/auto-assign", json={"shift_id": shift_id})
    assert r_auto.status_code == 200
    r_shift_cov = client.get("/api/events/1/shifts")
    shift_data = next(s for s in r_shift_cov.json() if s["id"] == shift_id)
    initial_cov = shift_data["coverage"]
    print(f"  [PASS] Shift #{shift_id} coverage: {initial_cov['assigned_count']}/{initial_cov['required_count']} ({initial_cov['coverage_percentage']}%)")

    # Ensure there is an active assigned volunteer on this shift
    active_assignments = [a for a in shift_data["assignments"] if a["status"] in ("Assigned", "Confirmed")]
    if not active_assignments:
        # Assign volunteer 1 or 2
        r_assign = client.post("/assignments/assign", json={"shift_id": shift_id, "volunteer_id": 1})
        assert r_assign.status_code == 200
        r_shift_cov = client.get("/api/events/1/shifts")
        shift_data = next(s for s in r_shift_cov.json() if s["id"] == shift_id)
        active_assignments = [a for a in shift_data["assignments"] if a["status"] in ("Assigned", "Confirmed")]

    assert len(active_assignments) > 0, "Shift has no active assignments to test dropout"
    victim = active_assignments[0]
    victim_vid = victim["volunteer_id"]
    victim_name = victim.get("volunteer_name", f"Volunteer #{victim_vid}")
    assigned_before = shift_data["coverage"]["assigned_count"]
    print(f"  [PASS] Active volunteer selected for dropout: {victim_name} (ID: {victim_vid})")

    # 3. Trigger Volunteer Dropout (POST /assignments/dropout)
    r_drop = client.post("/assignments/dropout", json={"shift_id": shift_id, "volunteer_id": victim_vid})
    assert r_drop.status_code == 200, f"Dropout failed: {r_drop.text}"
    drop_res = r_drop.json()

    # 4. Confirm response structure
    assert drop_res["shift_id"] == shift_id
    assert drop_res["volunteer_id"] == victim_vid
    assert "required_headcount" in drop_res
    assert "current_assigned_headcount" in drop_res
    assert "coverage_percentage" in drop_res
    assert "coverage_gap" in drop_res
    assert "replacement_suggestions" in drop_res
    assert len(drop_res["replacement_suggestions"]) > 0

    assigned_after = drop_res["current_assigned_headcount"]
    assert assigned_after < assigned_before, f"Expected assigned count to decrease: {assigned_before} -> {assigned_after}"
    assert drop_res["coverage_gap"] >= 1, f"Expected coverage gap to appear, got {drop_res['coverage_gap']}"
    print(f"  [PASS] Dropout successful! Coverage decreased: {assigned_before} -> {assigned_after}. Staffing gap: {drop_res['coverage_gap']}")

    # 5. Check Replacement Candidates scoring & details
    top_cand = drop_res["replacement_suggestions"][0]
    assert "volunteer_id" in top_cand
    assert "volunteer_name" in top_cand
    assert "skills" in top_cand
    assert "availability" in top_cand
    assert "current_workload" in top_cand
    assert "score" in top_cand
    assert "reason" in top_cand
    assert top_cand["score"] > 0
    print(f"  [PASS] Top replacement suggested: {top_cand['volunteer_name']} (Score: {top_cand['score']}/100, Reason: {top_cand['reason']})")

    # 6. Assign Replacement Volunteer
    chosen_replacement_id = top_cand["volunteer_id"]
    r_replace = client.post("/assignments/assign", json={
        "shift_id": shift_id,
        "volunteer_id": chosen_replacement_id
    })
    assert r_replace.status_code == 200, f"Assign replacement failed: {r_replace.text}"
    replace_res = r_replace.json()
    assert replace_res["coverage"]["assigned_count"] == assigned_after + 1
    print(f"  [PASS] Replacement assigned successfully! New assigned count: {replace_res['coverage']['assigned_count']}")

    # 7. Test Staffing Rebalancing Suggestions
    r_rebal = client.post("/assignments/rebalance", json={"event_id": 1, "apply": False})
    assert r_rebal.status_code == 200, f"Rebalance query failed: {r_rebal.text}"
    rebal_res = r_rebal.json()
    assert "suggestions" in rebal_res
    assert "understaffed_zones" in rebal_res
    assert "overstaffed_zones" in rebal_res

    print(f"  [PASS] Rebalance analysis: {len(rebal_res['suggestions'])} suggestions generated.")
    if len(rebal_res["suggestions"]) > 0:
        sug = rebal_res["suggestions"][0]
        assert "volunteer_id" in sug
        assert "from_shift_id" in sug
        assert "to_shift_id" in sug
        assert "expected_coverage_improvement" in sug
        print(f"  [PASS] Sample rebalancing suggestion: {sug.get('suggestion_text', sug['reason'])}")

        # 8. Accept a Rebalance Suggestion (POST /assignments/rebalance/accept)
        r_accept = client.post("/assignments/rebalance/accept", json={
            "volunteer_id": sug["volunteer_id"],
            "from_shift_id": sug["from_shift_id"],
            "to_shift_id": sug["to_shift_id"]
        })
        assert r_accept.status_code == 200, f"Accept rebalance failed: {r_accept.text}"
        acc_data = r_accept.json()
        assert "from_shift_coverage" in acc_data
        assert "to_shift_coverage" in acc_data
        print(f"  [PASS] Rebalance accepted & executed: {acc_data['message']}")

    # 9. Verify Dashboard Metrics include Phase 6 staffing & rebalancing info
    r_dash = client.get("/dashboard/metrics")
    assert r_dash.status_code == 200
    metrics = r_dash.json()
    assert "coverage_gaps_count" in metrics
    assert "understaffed_zones" in metrics
    assert "overstaffed_zones" in metrics
    assert "rebalancing_suggestions" in metrics
    assert "replacement_needed_shifts" in metrics
    print(f"  [PASS] Dashboard metrics confirmed: coverage_gaps={metrics['coverage_gaps_count']}, understaffed_zones={metrics['understaffed_zones']}, overstaffed_zones={metrics['overstaffed_zones']}")

    # 10. Verify previous systems still work with zero regressions
    # Attendance
    r_vols = client.get("/volunteers")
    assert r_vols.status_code == 200 and len(r_vols.json()) > 0
    # Task board
    r_tasks = client.get("/tasks")
    assert r_tasks.status_code == 200 and len(r_tasks.json()) > 0
    # Issues
    r_issues = client.get("/issues")
    assert r_issues.status_code == 200 and len(r_issues.json()) > 0
    # Announcements
    r_anns = client.get("/announcements")
    assert r_anns.status_code == 200 and len(r_anns.json()) > 0
    print("  [PASS] All existing systems (Attendance, Tasks, Issues, Announcements) verified intact!")

    print("\n==================================================")
    print("ALL PHASE 6 AUTOMATED TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    test_phase6()
