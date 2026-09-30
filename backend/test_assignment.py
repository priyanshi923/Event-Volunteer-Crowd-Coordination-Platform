import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8001"

def request(path, method="GET", body=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
        data_bytes = json.dumps(body).encode("utf-8")
    else:
        data_bytes = None
    try:
        with urllib.request.urlopen(req, data=data_bytes, timeout=5) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"FAILED request to {url}: {e}")
        return None

print("--- 1. Testing GET /shifts/1/suggestions ---")
suggs = request("/shifts/1/suggestions")
print("Suggestions (Top 3):", json.dumps(suggs, indent=2))
assert suggs is not None and len(suggs) <= 3

print("\n--- 2. Testing GET /assignments ---")
asgns = request("/assignments")
print("Assignments count:", len(asgns) if asgns else 0)
assert asgns is not None

print("\n--- 3. Testing POST /assignments/rebalance ---")
reb = request("/assignments/rebalance", method="POST", body={"apply": False})
print("Rebalance response:", reb)
assert reb is not None

print("\n--- 4. Testing POST /assignments/auto-assign ---")
auto = request("/assignments/auto-assign", method="POST", body={"shift_id": 1})
print("Auto-assign shift 1 response:", auto)
assert auto is not None

print("\n--- 5. Testing GET /api/events/1/shifts (Coverage Check) ---")
shifts = request("/api/events/1/shifts")
assert shifts is not None
print(f"First shift '{shifts[0]['title']}' coverage:", shifts[0].get("coverage"))
assert "coverage" in shifts[0]
assert "coverage_status" in shifts[0]["coverage"]

print("\n--- 6. Testing POST /assignments/dropout ---")
# Drop out volunteer 2 from shift 1
drop = request("/assignments/dropout", method="POST", body={"shift_id": 1, "volunteer_id": 2})
print("Dropout response:", drop)
assert drop is not None
assert "replacements" in drop
print("Replacements count:", len(drop.get("replacements", [])))

print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")
