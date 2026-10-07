from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_assignment():
    # Ensure seed data exists
    client.post("/api/seed?force=true")

    # 1. Testing GET /shifts/1/suggestions
    resp = client.get("/shifts/1/suggestions")
    assert resp.status_code == 200
    suggs = resp.json()
    assert suggs is not None and len(suggs) <= 3

    # 2. Testing GET /assignments
    resp = client.get("/assignments")
    assert resp.status_code == 200
    asgns = resp.json()
    assert asgns is not None

    # 3. Testing POST /assignments/rebalance
    resp = client.post("/assignments/rebalance", json={"apply": False})
    assert resp.status_code == 200
    reb = resp.json()
    assert reb is not None

    # 4. Testing POST /assignments/auto-assign
    resp = client.post("/assignments/auto-assign", json={"shift_id": 1})
    assert resp.status_code == 200
    auto = resp.json()
    assert auto is not None

    # 5. Testing GET /api/events/1/shifts (Coverage Check)
    resp = client.get("/api/events/1/shifts")
    assert resp.status_code == 200
    shifts = resp.json()
    assert shifts is not None and len(shifts) > 0
    assert "coverage" in shifts[0]
    assert "coverage_status" in shifts[0]["coverage"]

    # 6. Testing POST /assignments/dropout
    # Drop out volunteer 2 from shift 1
    resp = client.post("/assignments/dropout", json={"shift_id": 1, "volunteer_id": 2})
    assert resp.status_code == 200
    drop = resp.json()
    assert drop is not None
    assert "replacements" in drop or "replacement_suggestions" in drop

if __name__ == "__main__":
    test_assignment()

