"""
Events module tests: create -> list -> filter -> details -> zones/roles -> cover image -> validation.
"""
import sys
# Standardize UTF-8 stdout so checkmarks print on Windows cp1252 consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import os
from fastapi.testclient import TestClient
from main import app
import crud

client = TestClient(app)

# Smallest valid PNG (1x1 transparent pixel)
PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)


def test_events():
    print("=" * 60)
    print("RUNNING EVENTS MODULE TESTS")
    print("=" * 60)
    assert client.post("/api/seed?force=true").status_code == 200

    # 1. Create an event through the API
    payload = {
        "name": "  Riverside Marathon  ",
        "description": "City half marathon",
        "category": "Sports",
        "location": "Riverside Park",
        "start_date": "2026-11-08T06:00",
        "end_date": "2026-11-08T13:00",
        "volunteers_needed": 40,
        "is_featured": False,
        "status": "Upcoming",
    }
    r = client.post("/api/events", json=payload)
    assert r.status_code == 201, r.text
    ev = r.json()
    assert ev["name"] == "Riverside Marathon"
    assert ev["start_date"] == "2026-11-08 06:00"
    assert ev["volunteer_target"] == 40 and ev["volunteers_assigned"] == 0
    eid = ev["id"]
    print("  [PASS] Event created and normalized")

    # 2. It appears in the listing, with real computed numbers
    events = client.get("/api/events").json()
    assert any(e["id"] == eid for e in events)
    seeded = next(e for e in events if e["id"] != eid)
    assert seeded["volunteers_assigned"] > 0 and seeded["shift_count"] == 6
    print(f"  [PASS] Listing returns {len(events)} events with computed staffing")

    # 3. Categories come from stored events; filtering is server-side
    cats = {c["name"]: c["event_count"] for c in client.get("/api/events/categories").json()}
    assert cats.get("Sports") == 1 and cats.get("Festival") == 1, cats
    sports = client.get("/api/events", params={"category": "sports"}).json()
    assert [e["id"] for e in sports] == [eid]
    assert client.get("/api/events", params={"featured": True}).json()[0]["category"] == "Festival"
    print(f"  [PASS] Categories {sorted(cats)} and category filter")

    # 4. Zones and roles are scoped to the event
    z = client.post(f"/api/events/{eid}/zones", json={"name": "Start Line"})
    assert z.status_code == 201, z.text
    assert client.post(f"/api/events/{eid}/zones", json={"name": "start line"}).status_code == 400
    zone_id = z.json()["id"]
    assert client.put(f"/api/zones/{zone_id}", json={"name": "Start Area"}).json()["name"] == "Start Area"
    role = client.post("/api/roles", json={"event_id": eid, "name": "Water Station", "required_skill": "Logistics", "needed_count": 6})
    assert role.status_code == 201, role.text
    role_id = role.json()["id"]
    assert client.put(f"/api/roles/{role_id}", json={"needed_count": 8}).json()["needed_count"] == 8
    assert client.post("/api/roles", json={"event_id": 99999, "name": "x"}).status_code == 404
    assert "Start Area" in client.get(f"/api/events/{eid}/zone-names").json()
    print("  [PASS] Zone and role CRUD scoped to event")

    # 5. Details endpoint returns everything for the details page
    d = client.get(f"/api/events/{eid}/details").json()
    assert [zz["name"] for zz in d["zones"]] == ["Start Area"]
    assert d["roles"][0]["name"] == "Water Station" and d["shifts"] == []
    seeded_details = client.get(f"/api/events/{seeded['id']}/details").json()
    assert len(seeded_details["shifts"]) == 6 and len(seeded_details["volunteers"]) == seeded["volunteers_assigned"]
    assert client.get("/api/events/99999/details").status_code == 404
    print("  [PASS] Event details (zones, roles, shifts, volunteers)")

    # 6. Cover image upload: stored, served, replaced and removed
    up = client.put(f"/api/events/{eid}/image", content=PNG_1PX, headers={"Content-Type": "image/png"})
    assert up.status_code == 200, up.text
    url = up.json()["image_url"]
    assert url.startswith("/uploads/events/") and url.endswith(".png")
    served = client.get(url)
    assert served.status_code == 200 and served.content == PNG_1PX
    bad = client.put(f"/api/events/{eid}/image", content=b"not an image", headers={"Content-Type": "image/png"})
    assert bad.status_code == 400
    path = os.path.join(crud.EVENT_IMAGE_DIR, os.path.basename(url))
    assert os.path.isfile(path)
    cleared = client.delete(f"/api/events/{eid}/image").json()
    assert cleared["image_url"] == "" and not os.path.exists(path)
    print("  [PASS] Cover image upload, content sniffing and removal")

    # 7. Validation
    assert client.post("/api/events", json={"name": "   "}).status_code == 422
    assert client.post("/api/events", json={"name": "X", "start_date": "2026-11-08 10:00", "end_date": "2026-11-08 09:00"}).status_code == 422
    assert client.post("/api/events", json={"name": "X", "start_date": "tomorrow"}).status_code == 422
    assert client.post("/api/events", json={"name": "X", "volunteers_needed": -1}).status_code == 422
    assert client.put(f"/api/events/{eid}", json={"end_date": "2026-11-07 10:00"}).status_code == 400
    upd = client.put(f"/api/events/{eid}", json={"is_featured": True, "status": "active"}).json()
    assert upd["is_featured"] is True and upd["status"] == "Active"
    print("  [PASS] Validation and update")

    # 8. Dashboard counts events from the database
    m = client.get("/api/dashboard/metrics").json()
    assert m["total_events"] == 2 and m["active_events"] == 2
    print("  [PASS] Dashboard event counts")

    # 9. Deleting a role keeps its shifts; deleting a zone works
    assert client.delete(f"/api/roles/{role_id}").status_code == 200
    assert client.delete(f"/api/zones/{zone_id}").status_code == 200
    assert client.get(f"/api/events/{eid}/details").json()["zones"] == []
    print("  [PASS] Role and zone deletion")

    print("\nALL EVENTS MODULE TESTS PASSED")


if __name__ == "__main__":
    test_events()
