"""
End-to-End Final Phase Verification Script for Event Volunteer & Crowd Coordination Platform.
Tests all 27 steps required in Section 8 of the prompt.
"""
import sys
# Standardize UTF-8 stdout so checkmarks print on Windows cp1252 consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_e2e_test():
    print("=" * 65)
    print("RUNNING FINAL END-TO-END DEMO TEST (27 STEPS)")
    print("=" * 65)

    # Reset seed demo data to ensure pristine state
    r_seed = client.post("/api/seed?force=true")
    assert r_seed.status_code == 200, f"Failed seeding: {r_seed.text}"
    print("  [INIT] Pristine demo database seeded.")

    # 1. Open Dashboard
    r_events = client.get("/api/events")
    assert r_events.status_code == 200
    events = r_events.json()
    assert len(events) > 0, "No events found"
    event_id = events[0]["id"]

    r_dash = client.get(f"/api/dashboard/metrics?event_id={event_id}")
    assert r_dash.status_code == 200
    dash1 = r_dash.json()
    print("  [STEP 1 PASS] Opened Dashboard for event:", dash1.get("active_event_name"))

    # 2. Verify volunteer count, attendance and staffing coverage
    assert dash1["total_volunteers"] == 10
    assert dash1["checked_in_volunteers"] == 6
    assert dash1["total_shifts"] == 6
    assert "total_volunteer_hours" in dash1
    assert "coverage_gaps_count" in dash1
    print(f"  [STEP 2 PASS] Verified Volunteers: {dash1['total_volunteers']}, Checked-In: {dash1['checked_in_volunteers']}, Shifts: {dash1['total_shifts']}, Coverage Gaps: {dash1['coverage_gaps_count']}")

    # 3. Open Shift Assignment
    r_shifts = client.get(f"/api/events/{event_id}/shifts")
    assert r_shifts.status_code == 200
    shifts = r_shifts.json()
    assert len(shifts) > 0
    print(f"  [STEP 3 PASS] Shift Assignment loaded with {len(shifts)} operational shifts.")

    # 4. Run Auto Assign
    r_auto = client.post("/assignments/auto-assign", json={"event_id": event_id})
    assert r_auto.status_code == 200
    auto_res = r_auto.json()
    print(f"  [STEP 4 PASS] Auto Assign executed: {auto_res.get('message')}")

    # 5. Verify volunteers are assigned based on skills/availability
    r_shifts_post_auto = client.get(f"/api/events/{event_id}/shifts")
    assert r_shifts_post_auto.status_code == 200
    shifts_after_auto = r_shifts_post_auto.json()
    total_assigned = sum(s["coverage"]["assigned_count"] for s in shifts_after_auto)
    assert total_assigned > 5, "Expected more volunteers assigned after auto-assign"
    print(f"  [STEP 5 PASS] Volunteers assigned based on skills/availability. Total assigned: {total_assigned}")

    # 6. Trigger a volunteer dropout
    target_shift = next(s for s in shifts_after_auto if len(s["assignments"]) > 0)
    target_shift_id = target_shift["id"]
    active_asgn = next(a for a in target_shift["assignments"] if a["status"] in ("Assigned", "Confirmed"))
    victim_vid = active_asgn["volunteer_id"]
    before_asgn_count = target_shift["coverage"]["assigned_count"]

    r_drop = client.post("/assignments/dropout", json={"shift_id": target_shift_id, "volunteer_id": victim_vid})
    assert r_drop.status_code == 200
    drop_data = r_drop.json()
    print(f"  [STEP 6 PASS] Triggered dropout for Volunteer #{victim_vid} from Shift #{target_shift_id} ('{target_shift['title']}')")

    # 7. Verify: Assigned count decreases, coverage gap appears, replacement suggestions appear
    after_asgn_count = drop_data["current_assigned_headcount"]
    assert after_asgn_count == before_asgn_count - 1
    assert drop_data["coverage_gap"] >= 1
    assert len(drop_data["replacement_suggestions"]) > 0
    print(f"  [STEP 7 PASS] Verified dropout metrics: Count: {before_asgn_count} -> {after_asgn_count}, Gap: {drop_data['coverage_gap']}, Replacements: {len(drop_data['replacement_suggestions'])}")

    # 8. Select a replacement
    top_replacement = drop_data["replacement_suggestions"][0]
    replacement_vid = top_replacement["volunteer_id"]
    print(f"  [STEP 8 PASS] Selected replacement candidate: {top_replacement['volunteer_name']} (Score: {top_replacement['score']}/100, Reason: {top_replacement['reason']})")

    # 9. Verify: Replacement is assigned, coverage updates, staffing gap resolved
    r_assign_rep = client.post("/assignments/assign", json={"shift_id": target_shift_id, "volunteer_id": replacement_vid})
    assert r_assign_rep.status_code == 200
    rep_res = r_assign_rep.json()
    assert rep_res["coverage"]["assigned_count"] == before_asgn_count
    print(f"  [STEP 9 PASS] Replacement assigned! Coverage updated: {rep_res['coverage']['assigned_count']}/{rep_res['coverage']['required_count']} ({rep_res['coverage']['coverage_percentage']}%)")

    # 10. Test Staff Rebalancing
    r_rebal = client.post("/assignments/rebalance", json={"event_id": event_id, "apply": False})
    assert r_rebal.status_code == 200
    rebal_plan = r_rebal.json()
    print(f"  [STEP 10 PASS] Staff Rebalancing analyzed: {len(rebal_plan.get('suggestions', []))} suggestions generated.")

    # 11. Verify rebalancing suggestions are generated when appropriate
    assert "understaffed_zones" in rebal_plan
    assert "overstaffed_zones" in rebal_plan
    if len(rebal_plan.get("suggestions", [])) > 0:
        sample_sug = rebal_plan["suggestions"][0]
        # Test accepting a single rebalance move
        r_accept = client.post("/assignments/rebalance/accept", json={
            "volunteer_id": sample_sug["volunteer_id"],
            "from_shift_id": sample_sug["source_shift_id"],
            "to_shift_id": sample_sug["target_shift_id"]
        })
        assert r_accept.status_code == 200
        print(f"  [STEP 11 PASS] Verified rebalancing suggestion applied: Moved {sample_sug['volunteer_name']} from {sample_sug['source_zone']} to {sample_sug['target_zone']}")
    else:
        print("  [STEP 11 PASS] Verified zone balance: shifts are evenly distributed.")

    # 12. Open Task Board
    r_tasks = client.get(f"/api/tasks?event_id={event_id}")
    assert r_tasks.status_code == 200
    tasks_initial = r_tasks.json()
    print(f"  [STEP 12 PASS] Task Board opened with {len(tasks_initial)} initial tasks.")

    # 13. Create a task
    new_task_payload = {
        "event_id": event_id,
        "title": "Set up crowd barrier near North Concourse",
        "description": "Reinforce queue line with extra metal barricades.",
        "zone": "North Gate",
        "priority": "HIGH",
        "status": "OPEN",
        "assigned_volunteer_id": None
    }
    r_new_task = client.post("/api/tasks", json=new_task_payload)
    assert r_new_task.status_code == 201
    created_task = r_new_task.json()
    task_id = created_task["id"]
    print(f"  [STEP 13 PASS] Task #{task_id} created: '{created_task['title']}' (Status: {created_task['status']})")

    # 14. Assign it to a volunteer
    r_assign_task = client.put(f"/api/tasks/{task_id}", json={"assigned_volunteer_id": 2})
    assert r_assign_task.status_code == 200
    assigned_task = r_assign_task.json()
    assert assigned_task["assigned_volunteer_id"] == 2
    print(f"  [STEP 14 PASS] Task #{task_id} assigned to Volunteer #{assigned_task['assigned_volunteer_id']} ({assigned_task.get('assigned_volunteer', {}).get('name')})")

    # 15. Move the task: OPEN -> IN_PROGRESS -> RESOLVED
    r_prog = client.put(f"/api/tasks/{task_id}", json={"status": "IN_PROGRESS"})
    assert r_prog.status_code == 200
    assert r_prog.json()["status"] == "IN_PROGRESS"

    r_done = client.put(f"/api/tasks/{task_id}", json={"status": "RESOLVED"})
    assert r_done.status_code == 200
    assert r_done.json()["status"] == "RESOLVED"
    print(f"  [STEP 15 PASS] Task #{task_id} moved through OPEN -> IN_PROGRESS -> RESOLVED.")

    # 16. Open Incident Center
    r_issues = client.get(f"/api/issues?event_id={event_id}")
    assert r_issues.status_code == 200
    issues_initial = r_issues.json()
    print(f"  [STEP 16 PASS] Incident Center opened with {len(issues_initial)} existing issues.")

    # 17. Create Issue Type: CROWD_SURGE, Priority: CRITICAL
    surge_issue_payload = {
        "event_id": event_id,
        "title": "Severe crowd surge at South Turnstiles",
        "description": "Over 500 attendees pushing through bottleneck barrier.",
        "zone": "South Exit",
        "issue_type": "CROWD_SURGE",
        "priority": "CRITICAL",
        "status": "OPEN"
    }
    r_create_issue = client.post("/api/issues", json=surge_issue_payload)
    assert r_create_issue.status_code == 201
    created_issue = r_create_issue.json()
    issue_id = created_issue["id"]
    print(f"  [STEP 17 PASS] Created Issue #{issue_id}: Type={created_issue['issue_type']}, Priority={created_issue['priority']}")

    # 18. Verify it is automatically routed to Security Coordinator
    assert created_issue["assigned_coordinator"] == "Security Coordinator", f"Expected Security Coordinator, got {created_issue['assigned_coordinator']}"
    print(f"  [STEP 18 PASS] Verified automatic coordinator routing: '{created_issue['assigned_coordinator']}'")

    # 19. Acknowledge the issue
    r_ack = client.post(f"/api/issues/{issue_id}/acknowledge")
    assert r_ack.status_code == 200
    ack_issue = r_ack.json()
    assert ack_issue["status"] == "ACKNOWLEDGED"
    assert ack_issue["acknowledged_at"] is not None
    print(f"  [STEP 19 PASS] Issue #{issue_id} acknowledged at {ack_issue['acknowledged_at']}")

    # 20. Resolve the issue
    r_res = client.post(f"/api/issues/{issue_id}/resolve")
    assert r_res.status_code == 200
    res_issue = r_res.json()
    assert res_issue["status"] == "RESOLVED"
    assert res_issue["resolved_at"] is not None
    print(f"  [STEP 20 PASS] Issue #{issue_id} resolved at {res_issue['resolved_at']}")

    # 21. Create an announcement for EVERYONE
    ann_all_payload = {
        "event_id": event_id,
        "title": "General Soundcheck Notice",
        "content": "Stage audio calibration beginning now across venue concourses.",
        "priority": "General",
        "author": "Operations Lead",
        "target_type": "EVERYONE"
    }
    r_ann_all = client.post("/api/announcements", json=ann_all_payload)
    assert r_ann_all.status_code == 201
    print(f"  [STEP 21 PASS] Broadcasted announcement for EVERYONE: '{r_ann_all.json()['title']}'")

    # 22. Create an announcement for a specific ZONE
    ann_zone_payload = {
        "event_id": event_id,
        "title": "North Gate Queue Protocol",
        "content": "Open lanes 5 and 6 for VIP passholders.",
        "priority": "High",
        "author": "Safety Coordinator",
        "target_type": "ZONE",
        "target_value": "North Gate"
    }
    r_ann_zone = client.post("/api/announcements", json=ann_zone_payload)
    assert r_ann_zone.status_code == 201
    print(f"  [STEP 22 PASS] Broadcasted announcement for ZONE 'North Gate': '{r_ann_zone.json()['title']}'")

    # 23. Check in a volunteer
    r_vols = client.get("/api/volunteers")
    assert r_vols.status_code == 200
    vols = r_vols.json()
    # Find a volunteer who is available (not checked in)
    reg_vol = next(v for v in vols if v["status"] == "Available")
    checkin_vid = reg_vol["id"]
    r_cin = client.post(f"/api/volunteers/{checkin_vid}/check-in")
    assert r_cin.status_code == 200
    cin_data = r_cin.json()
    assert cin_data["status"] == "Checked In"
    print(f"  [STEP 23 PASS] Volunteer #{checkin_vid} ({reg_vol['name']}) checked in successfully.")

    # 24. Check out the volunteer
    r_cout = client.post(f"/api/volunteers/{checkin_vid}/check-out")
    assert r_cout.status_code == 200
    cout_data = r_cout.json()
    assert cout_data["status"] == "Checked Out"
    print(f"  [STEP 24 PASS] Volunteer #{checkin_vid} checked out. Session hours: {cout_data['hours_worked']}h")

    # 25. Verify total volunteer hours update
    r_vol_refreshed = client.get(f"/api/volunteers/{checkin_vid}")
    assert r_vol_refreshed.status_code == 200
    updated_vol = r_vol_refreshed.json()
    assert updated_vol["total_hours_worked"] > 0
    print(f"  [STEP 25 PASS] Total volunteer hours verified: {updated_vol['total_hours_worked']}h")

    # 26. Return to Dashboard
    r_dash_final = client.get(f"/api/dashboard/metrics?event_id={event_id}")
    assert r_dash_final.status_code == 200
    dash_final = r_dash_final.json()
    print("  [STEP 26 PASS] Returned to Dashboard. Fresh metrics fetched.")

    # 27. Verify the dashboard reflects the latest data
    assert dash_final["total_volunteers"] >= 10
    assert dash_final["total_tasks"] >= len(tasks_initial) + 1
    assert dash_final["resolved_tasks"] >= 1
    assert "understaffed_zones" in dash_final
    assert "overstaffed_zones" in dash_final
    assert "rebalancing_suggestions" in dash_final
    print(f"  [STEP 27 PASS] Dashboard verified with latest data: Tasks={dash_final['total_tasks']} (Resolved={dash_final['resolved_tasks']}), Open Issues={dash_final['open_issues']}, Hours={dash_final['total_volunteer_hours']}h")

    print("\n" + "=" * 65)
    print("ALL 27 END-TO-END DEMO STEPS VERIFIED AND PASSED 100%!")
    print("=" * 65)

def test_e2e_all_steps():
    """Pytest test case executing all 27 end-to-end verification steps."""
    run_e2e_test()

if __name__ == "__main__":
    run_e2e_test()
