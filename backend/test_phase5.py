import sys
# Standardize UTF-8 stdout so checkmarks print on Windows cp1252 consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from fastapi.testclient import TestClient
from main import app, init_db
from database import SessionLocal
import models

def test_phase5():
    init_db()
    client = TestClient(app)

    print("=== Testing Phase 5: Issues, Escalations & Announcements ===")
    r_seed = client.post("/api/seed?force=true")
    assert r_seed.status_code == 200, f"Seeding failed: {r_seed.text}"

    # 1. Test Coordinator Routing Rules
    routing_cases = [
        ("MEDICAL", "First Aid Coordinator"),
        ("CROWD_SURGE", "Security Coordinator"),
        ("SECURITY", "Security Coordinator"),
        ("MISSING_EQUIPMENT", "Operations Coordinator"),
        ("OTHER", "Event Coordinator"),
    ]

    for issue_type, expected_coord in routing_cases:
        res = client.post("/issues", json={
            "title": f"Test {issue_type} Issue",
            "description": f"Testing automatic routing for {issue_type}",
            "zone": "Main Stage",
            "issue_type": issue_type,
            "priority": "HIGH",
            "status": "OPEN"
        })
        assert res.status_code == 201, f"Failed to create {issue_type}: {res.text}"
        data = res.json()
        assert data["assigned_coordinator"] == expected_coord, \
            f"Expected {expected_coord} for {issue_type}, got {data['assigned_coordinator']}"
        assert data["is_urgent"] == True
        assert data["requires_attention"] == True
        print(f"  [PASS] Auto-routing for {issue_type} -> {expected_coord}")

    # 2. Test Priority and Urgency computation
    # LOW priority -> not urgent
    res_low = client.post("/issues", json={
        "title": "Low Priority Test",
        "zone": "Food Court",
        "issue_type": "OTHER",
        "priority": "LOW",
        "status": "OPEN"
    })
    assert res_low.status_code == 201
    assert res_low.json()["is_urgent"] == False
    assert res_low.json()["requires_attention"] == False
    print("  [PASS] LOW priority issue correctly flagged as non-urgent")

    # CRITICAL priority -> urgent
    res_crit = client.post("/issues", json={
        "title": "Critical Bleeding Patient",
        "zone": "Medical Tent",
        "issue_type": "MEDICAL",
        "priority": "CRITICAL",
        "status": "OPEN"
    })
    assert res_crit.status_code == 201
    crit_id = res_crit.json()["id"]
    assert res_crit.json()["is_urgent"] == True
    assert res_crit.json()["requires_attention"] == True
    print("  [PASS] CRITICAL priority issue correctly flagged as urgent")

    # 3. Test Acknowledge Issue
    res_ack = client.post(f"/issues/{crit_id}/acknowledge")
    assert res_ack.status_code == 200
    ack_data = res_ack.json()
    assert ack_data["status"] == "ACKNOWLEDGED"
    assert ack_data["acknowledged_at"] is not None
    # When acknowledged, it's no longer OPEN, so requires_attention is False
    assert ack_data["requires_attention"] == False
    print(f"  [PASS] Issue #{crit_id} transitioned to ACKNOWLEDGED with timestamp")

    # 4. Test Resolve Issue
    res_res = client.post(f"/issues/{crit_id}/resolve")
    assert res_res.status_code == 200
    res_data = res_res.json()
    assert res_data["status"] == "RESOLVED"
    assert res_data["resolved_at"] is not None
    print(f"  [PASS] Issue #{crit_id} transitioned to RESOLVED with timestamp")

    # 5. Verify database persistence
    db = SessionLocal()
    db_issue = db.query(models.Issue).filter(models.Issue.id == crit_id).first()
    assert db_issue is not None
    assert db_issue.status == "RESOLVED"
    assert db_issue.resolved_at is not None
    assert db_issue.acknowledged_at is not None
    db.close()
    print("  [PASS] Issue persistence verified in SQLite database")

    # 6. Test GET /issues with filters
    res_filter_status = client.get("/issues?status=RESOLVED")
    assert res_filter_status.status_code == 200
    assert any(i["id"] == crit_id for i in res_filter_status.json())

    res_filter_type = client.get("/issues?issue_type=MEDICAL")
    assert res_filter_type.status_code == 200
    assert all(i["issue_type"] == "MEDICAL" for i in res_filter_type.json())
    print("  [PASS] GET /issues filter by status and issue_type verified")

    # 7. Test Announcements creation with EVERYONE, ZONE, ROLE
    ann_tests = [
        {"title": "Global Advisory", "message": "Stay hydrated", "target_type": "EVERYONE"},
        {"title": "Gate Congestion", "message": "North Gate lane 2 opened", "target_type": "ZONE", "target_value": "North Gate"},
        {"title": "Medic Shift Alert", "message": "Report to tent 3", "target_type": "ROLE", "target_value": "First Aid Responder"},
    ]
    for ann in ann_tests:
        r = client.post("/announcements", json=ann)
        assert r.status_code == 201, f"Failed announcement {ann}: {r.text}"
        data = r.json()
        assert data["target_type"] == ann["target_type"]
        assert data["message"] == ann["message"]
        assert data["content"] == ann["message"]
    print("  [PASS] Announcements created for EVERYONE, ZONE, ROLE")

    # 8. Test GET /announcements
    r_anns = client.get("/announcements")
    assert r_anns.status_code == 200
    assert len(r_anns.json()) >= 3
    print("  [PASS] GET /announcements returns feed")

    # 9. Test Dashboard Metrics
    r_dash = client.get("/dashboard/metrics")
    assert r_dash.status_code == 200
    metrics = r_dash.json()
    assert "open_issues" in metrics
    assert "critical_issues" in metrics
    assert "high_priority_issues" in metrics
    assert "urgent_issues" in metrics
    assert "open_tasks" in metrics
    assert "tasks_in_progress" in metrics
    assert "resolved_tasks" in metrics
    print(f"  [PASS] Dashboard metrics: open_issues={metrics['open_issues']}, critical={metrics['critical_issues']}, urgent={len(metrics['urgent_issues'])}")

    print("\nALL PHASE 5 TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_phase5()
