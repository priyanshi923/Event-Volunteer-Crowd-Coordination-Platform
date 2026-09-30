import sys
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("Testing backend endpoints using TestClient...")
    
    # 1. Test GET /volunteers
    r = client.get("/volunteers")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    volunteers = r.json()
    print(f"Retrieved {len(volunteers)} volunteers.")
    assert len(volunteers) > 0, "No volunteers found"
    
    v = volunteers[0]
    print("Sample volunteer:", v["name"], v["status"])
    required_keys = ["id", "name", "skills", "availability", "preferences", "contact_details", "status", "total_hours_worked", "current_assigned_shifts"]
    for k in required_keys:
        assert k in v, f"Key '{k}' missing from volunteer response: {v}"
    print("[PASS] GET /volunteers schema verified successfully!")
    
    vid = v["id"]
    name = v["name"]
    status = v["status"]
    
    # 2. Test GET /volunteers/{vid}
    r = client.get(f"/volunteers/{vid}")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    v_detail = r.json()
    assert "attendance_history" in v_detail, "attendance_history missing from detail response"
    print(f"[PASS] GET /volunteers/{vid} includes attendance_history ({len(v_detail['attendance_history'])} records)!")
    
    # Clean state: if currently checked-in, check out first
    if v_detail["status"] in ["Checked In", "Checked-in"]:
        r_reset = client.post(f"/volunteers/{vid}/check-out")
        print("Reset check-out status:", r_reset.status_code)
    
    # 3. Test Check-in
    r_in = client.post(f"/volunteers/{vid}/check-in")
    assert r_in.status_code == 200, f"Check-in failed: {r_in.text}"
    ci_data = r_in.json()
    print("Check-in response:", ci_data)
    assert ci_data["volunteer_name"] == name
    assert ci_data["status"] == "Checked In"
    assert "check_in_time" in ci_data and ci_data["check_in_time"]
    print("[PASS] Check-in endpoint works.")
    
    # 4. Duplicate Check-in prevention
    r_dup = client.post(f"/volunteers/{vid}/check-in")
    assert r_dup.status_code == 400, f"Expected 400 for duplicate check-in, got {r_dup.status_code}"
    print(f"[PASS] Duplicate check-in correctly blocked: {r_dup.json()['detail']}")
    
    # 5. Check-out
    r_out = client.post(f"/volunteers/{vid}/check-out")
    assert r_out.status_code == 200, f"Check-out failed: {r_out.text}"
    co_data = r_out.json()
    print("Check-out response:", co_data)
    assert co_data["volunteer_name"] == name
    assert co_data["status"] == "Checked Out"
    assert "hours_worked" in co_data
    assert "check_in_time" in co_data
    assert "check_out_time" in co_data
    print(f"[PASS] Check-out endpoint works (hours calculated: {co_data['hours_worked']}).")
    
    # 6. Duplicate/Invalid Check-out prevention
    r_out_dup = client.post(f"/volunteers/{vid}/check-out")
    assert r_out_dup.status_code == 400, f"Expected 400 for checkout without active check-in, got {r_out_dup.status_code}"
    print(f"[PASS] Invalid checkout correctly blocked: {r_out_dup.json()['detail']}")
    
    # 7. Test Dashboard Metrics
    r_dash = client.get("/dashboard/metrics")
    assert r_dash.status_code == 200
    metrics = r_dash.json()
    print("Dashboard metrics:", metrics)
    assert "total_volunteers" in metrics
    assert "present_volunteers" in metrics
    assert "total_volunteer_hours" in metrics
    assert "available_volunteers" in metrics
    print("[PASS] Dashboard metrics includes attendance metrics.")
    
    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
