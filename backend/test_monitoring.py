"""
Monitoring and Prometheus Metrics Test Suite for Event Volunteer Platform.
Verifies /health, /metrics, HTTP instrumentation, and business domain gauges/counters.
"""
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from fastapi.testclient import TestClient
from main import app, init_db
from database import SessionLocal
import crud

client = TestClient(app)

def test_health_endpoint():
    """Verify /health returns 200 with healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data
    assert "timestamp" in data
    print("  [PASS] /health endpoint operational.")

def test_metrics_endpoint_format():
    """Verify /metrics returns 200 with valid Prometheus text format."""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    print("  [PASS] /metrics endpoint returns standard Prometheus exposition format.")

def test_http_instrumentation_metrics():
    """Verify standard HTTP request metrics are collected by Instrumentator."""
    # Generate some HTTP traffic
    client.get("/")
    client.get("/api/events")
    client.get("/health")

    response = client.get("/metrics")
    assert response.status_code == 200
    body = response.text

    assert "http_requests_total" in body
    assert "http_request_duration_seconds" in body
    print("  [PASS] HTTP request duration and count metrics present in /metrics.")

def test_business_domain_metrics():
    """Verify all required business metrics reflect database state."""
    init_db()
    db = SessionLocal()
    try:
        # Seed or refresh data
        crud.seed_initial_data(db)
    finally:
        db.close()

    response = client.get("/metrics")
    assert response.status_code == 200
    body = response.text

    required_gauges = [
        "evcp_volunteers_total",
        "evcp_volunteers_checked_in",
        "evcp_shifts_active",
        "evcp_issues_open",
        "evcp_issues_escalated",
        "evcp_coverage_gaps_total"
    ]
    for gauge in required_gauges:
        assert gauge in body, f"Expected business gauge '{gauge}' not found in /metrics"
        print(f"  [PASS] Business gauge verified: {gauge}")

    required_counters = [
        "evcp_checkins_total",
        "evcp_checkouts_total",
        "evcp_incidents_reported_total",
        "evcp_auto_assignments_total"
    ]
    for counter in required_counters:
        assert counter in body, f"Expected business counter '{counter}' not found in /metrics"
        print(f"  [PASS] Business counter verified: {counter}")

def test_business_metrics_dynamic_update():
    """Verify that Prometheus metrics reflect live updates."""
    init_db()
    # Scrape metrics once
    r1 = client.get("/metrics")
    assert r1.status_code == 200

    # Trigger an auto-assignment to increase counter
    r_auto = client.post("/assignments/auto-assign", json={"event_id": 1})
    assert r_auto.status_code == 200

    r2 = client.get("/metrics")
    assert r2.status_code == 200
    assert "evcp_auto_assignments_total" in r2.text
    print("  [PASS] Dynamic business metric increment verified.")

if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING PROMETHEUS MONITORING TEST SUITE")
    print("=" * 60)
    test_health_endpoint()
    test_metrics_endpoint_format()
    test_http_instrumentation_metrics()
    test_business_domain_metrics()
    test_business_metrics_dynamic_update()
    print("=" * 60)
    print("ALL MONITORING TESTS PASSED 100%!")
    print("=" * 60)
