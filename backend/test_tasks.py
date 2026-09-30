import sys
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_task_tests():
    print("=" * 60)
    print("RUNNING LIVE TASK BOARD COMPREHENSIVE TESTS")
    print("=" * 60)

    # 1. Test GET /tasks
    r = client.get("/tasks")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    tasks = r.json()
    print(f"[PASS] GET /tasks retrieved {len(tasks)} tasks.")
    assert len(tasks) > 0, "Expected at least 1 task"

    sample = tasks[0]
    required_fields = [
        "id", "title", "description", "zone", "priority",
        "status", "assigned_volunteer", "created_time", "updated_time"
    ]
    for field in required_fields:
        assert field in sample, f"Missing required field '{field}' in task response"
    print(f"[PASS] Task schema verified with all required fields: {list(sample.keys())}")

    # Check allowed statuses and priorities
    allowed_statuses = ["OPEN", "IN_PROGRESS", "RESOLVED"]
    allowed_priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    for t in tasks:
        assert t["status"] in allowed_statuses, f"Invalid status '{t['status']}' in task {t['id']}"
        assert t["priority"] in allowed_priorities, f"Invalid priority '{t['priority']}' in task {t['id']}"
    print("[PASS] All existing tasks normalized to allowed statuses and priorities.")

    # 2. Test Volunteer validation when creating a task
    # Invalid volunteer ID
    r_invalid_vol = client.post("/tasks", json={
        "title": "Invalid Vol Test",
        "description": "Should fail",
        "zone": "North Gate",
        "priority": "HIGH",
        "assigned_volunteer_id": 99999
    })
    assert r_invalid_vol.status_code == 404, f"Expected 404 for invalid volunteer, got {r_invalid_vol.status_code}"
    print(f"[PASS] Invalid volunteer blocked with 404: {r_invalid_vol.json()['detail']}")

    # 3. Test POST /tasks (Valid creation with default OPEN status)
    # Get a real volunteer
    r_vols = client.get("/volunteers")
    assert r_vols.status_code == 200
    volunteers = r_vols.json()
    real_vol = volunteers[0]
    real_vid = real_vol["id"]

    new_task_payload = {
        "title": "Deploy Emergency Defibrillator Unit",
        "description": "Place unit at Section B medical stand",
        "zone": "Medical Tent",
        "priority": "CRITICAL",
        "assigned_volunteer_id": real_vid
    }
    r_create = client.post("/tasks", json=new_task_payload)
    assert r_create.status_code == 201, f"Expected 201, got {r_create.status_code}: {r_create.text}"
    created_task = r_create.json()
    print("[PASS] Created new task successfully:", created_task["id"], created_task["title"])
    assert created_task["status"] == "OPEN", f"Expected default status OPEN, got {created_task['status']}"
    assert created_task["priority"] == "CRITICAL"
    assert created_task["zone"] == "Medical Tent"
    assert created_task["assigned_volunteer_id"] == real_vid
    assert created_task["assigned_volunteer"] is not None
    assert created_task["created_time"] is not None
    created_id = created_task["id"]

    # 4. Test State Transition: OPEN -> IN_PROGRESS
    r_step1 = client.put(f"/tasks/{created_id}", json={"status": "IN_PROGRESS"})
    assert r_step1.status_code == 200, f"Expected 200, got {r_step1.status_code}: {r_step1.text}"
    updated_step1 = r_step1.json()
    assert updated_step1["status"] == "IN_PROGRESS", f"Expected IN_PROGRESS, got {updated_step1['status']}"
    print("[PASS] OPEN -> IN_PROGRESS transition works.")

    # 5. Test State Transition: IN_PROGRESS -> RESOLVED
    r_step2 = client.put(f"/tasks/{created_id}", json={"status": "RESOLVED"})
    assert r_step2.status_code == 200, f"Expected 200, got {r_step2.status_code}: {r_step2.text}"
    updated_step2 = r_step2.json()
    assert updated_step2["status"] == "RESOLVED", f"Expected RESOLVED, got {updated_step2['status']}"
    print("[PASS] IN_PROGRESS -> RESOLVED transition works.")

    # 6. Test Reassigning Volunteer & Updating Priority
    r_update_details = client.put(f"/tasks/{created_id}", json={
        "priority": "LOW",
        "assigned_volunteer_id": None
    })
    assert r_update_details.status_code == 200
    unassigned = r_update_details.json()
    assert unassigned["priority"] == "LOW"
    assert unassigned["assigned_volunteer_id"] is None
    print("[PASS] Task detail updates (priority and unassigning) work.")

    # 7. Test Invalid Status Validation on PUT
    r_invalid_status = client.put(f"/tasks/{created_id}", json={"status": "INVALID_STATE"})
    assert r_invalid_status.status_code == 400, f"Expected 400 for invalid status, got {r_invalid_status.status_code}"
    print(f"[PASS] Invalid status rejected with 400: {r_invalid_status.json()['detail']}")

    # 8. Test Zone Filter
    r_filtered = client.get("/tasks", params={"zone": "Medical Tent"})
    assert r_filtered.status_code == 200
    filtered_tasks = r_filtered.json()
    for t in filtered_tasks:
        assert t["zone"] == "Medical Tent", f"Expected zone Medical Tent, got {t['zone']}"
    print(f"[PASS] Zone filter /tasks?zone=Medical Tent returned {len(filtered_tasks)} matching tasks.")

    # 9. Test DELETE /tasks/{task_id}
    r_delete = client.delete(f"/tasks/{created_id}")
    assert r_delete.status_code == 200, f"Expected 200, got {r_delete.status_code}"
    print(f"[PASS] Task {created_id} deleted successfully.")

    # Second delete returns 404
    r_delete_again = client.delete(f"/tasks/{created_id}")
    assert r_delete_again.status_code == 404, f"Expected 404, got {r_delete_again.status_code}"
    print("[PASS] Duplicate delete returned 404 as expected.")

    # 10. Test Dashboard Metrics task counts
    r_dash = client.get("/dashboard/metrics")
    assert r_dash.status_code == 200
    metrics = r_dash.json()
    print("Dashboard task metrics:", {
        "total_tasks": metrics.get("total_tasks"),
        "open_tasks": metrics.get("open_tasks"),
        "in_progress_tasks": metrics.get("in_progress_tasks"),
        "resolved_tasks": metrics.get("resolved_tasks"),
        "critical_high_open_tasks": metrics.get("critical_high_open_tasks")
    })
    assert "total_tasks" in metrics
    assert "open_tasks" in metrics
    assert "in_progress_tasks" in metrics
    assert "resolved_tasks" in metrics
    assert "critical_high_open_tasks" in metrics
    print("[PASS] Dashboard task metrics confirmed.")

    # 11. Verify attendance and assignment engine still functional
    r_vol_detail = client.get(f"/volunteers/{real_vid}")
    assert r_vol_detail.status_code == 200
    assert "total_hours_worked" in r_vol_detail.json()
    assert "attendance_history" in r_vol_detail.json()
    print("[PASS] Existing volunteer attendance and profile features still intact.")

    print("\n" + "=" * 60)
    print("ALL LIVE TASK BOARD TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_task_tests()
