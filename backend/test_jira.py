import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from database import SessionLocal
import models
from jira_service import JiraService, jira_service

client = TestClient(app)

# ---------------------------------------------------------
# Test 1: Status Mapping
# ---------------------------------------------------------
def test_status_mapping():
    service = JiraService()
    # EVCP -> Jira mapping
    assert service.map_evcp_to_jira_status("OPEN") == "To Do"
    assert service.map_evcp_to_jira_status("TODO") == "To Do"
    assert service.map_evcp_to_jira_status("IN_PROGRESS") == "In Progress"
    assert service.map_evcp_to_jira_status("RESOLVED") == "Done"
    assert service.map_evcp_to_jira_status("DONE") == "Done"

    # Jira -> EVCP mapping
    assert service.map_jira_to_evcp_status("To Do") == "OPEN"
    assert service.map_jira_to_evcp_status("In Progress") == "IN_PROGRESS"
    assert service.map_jira_to_evcp_status("Done") == "RESOLVED"
    assert service.map_jira_to_evcp_status("Resolved") == "RESOLVED"
    assert service.map_jira_to_evcp_status("Closed") == "RESOLVED"

# ---------------------------------------------------------
# Test 2: Jira Status Endpoint
# ---------------------------------------------------------
def test_jira_status_endpoint():
    response = client.get("/api/jira/status")
    assert response.status_code == 200
    data = response.json()
    assert "connected" in data
    assert "projectKey" in data
    assert "baseUrl" in data
    # Ensure token is never leaked in status
    assert "api_token" not in data
    assert "token" not in data

# ---------------------------------------------------------
# Test 3: Issue Creation & Transition Logic
# ---------------------------------------------------------
@patch.object(jira_service, 'create_issue')
@patch.object(jira_service, 'transition_issue')
def test_task_creation_and_transition(mock_trans, mock_create):
    mock_create.return_value = {"id": "99991", "key": "EVCP-999"}
    mock_trans.return_value = True

    # Create task
    payload = {
        "title": "Setup Zone B Hydration Station",
        "description": "Distribute 50 crates of bottled water",
        "zone": "Zone B",
        "priority": "HIGH",
        "status": "OPEN"
    }
    resp = client.post("/api/tasks", json=payload)
    assert resp.status_code == 201
    task_data = resp.json()
    task_id = task_data["id"]
    assert task_data["jira_issue_key"] == "EVCP-999"

    # Update task status to IN_PROGRESS
    update_payload = {"status": "IN_PROGRESS"}
    resp_update = client.put(f"/api/tasks/{task_id}", json=update_payload)
    assert resp_update.status_code == 200
    updated_data = resp_update.json()
    assert updated_data["status"] == "IN_PROGRESS"
    assert updated_data["jira_sync_status"] == "synced"
    mock_trans.assert_called_with("EVCP-999", "IN_PROGRESS")

# ---------------------------------------------------------
# Test 4: Webhook Processing (Jira -> EVCP)
# ---------------------------------------------------------
def test_jira_webhook_processing():
    db = SessionLocal()
    # Create a dummy task in DB with Jira key
    test_task = models.Task(
        event_id=1,
        title="Webhook Test Task",
        description="Testing incoming Jira status changes",
        zone="Zone A",
        priority="MEDIUM",
        status="OPEN",
        jira_issue_key="EVCP-888"
    )
    db.add(test_task)
    db.commit()
    db.refresh(test_task)
    task_id = test_task.id
    db.close()

    # Send Jira webhook with status change to "In Progress"
    webhook_payload = {
        "webhookEvent": "jira:issue_updated",
        "issue": {
            "id": "10888",
            "key": "EVCP-888",
            "fields": {
                "summary": "Webhook Test Task",
                "status": {
                    "name": "In Progress"
                }
            }
        }
    }
    resp = client.post("/api/jira/webhook", json=webhook_payload)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["status"] == "synchronized"
    assert res_data["new_status"] == "IN_PROGRESS"

    # Check local task updated
    db = SessionLocal()
    check_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    assert check_task.status == "IN_PROGRESS"

    # Duplicate webhook should return "unchanged" (Idempotency)
    resp_dup = client.post("/api/jira/webhook", json=webhook_payload)
    assert resp_dup.status_code == 200
    assert resp_dup.json()["status"] == "unchanged"

    # Clean up
    db.delete(check_task)
    db.commit()
    db.close()

# ---------------------------------------------------------
# Test 5: Manual Task Sync Endpoint
# ---------------------------------------------------------
@patch.object(jira_service, 'get_issue')
def test_task_jira_sync_endpoint(mock_get_issue):
    mock_get_issue.return_value = {
        "key": "EVCP-777",
        "fields": {
            "status": {"name": "Done"}
        }
    }

    db = SessionLocal()
    sync_task = models.Task(
        event_id=1,
        title="Sync Verification Task",
        description="Verify manual sync",
        zone="Zone C",
        priority="LOW",
        status="OPEN",
        jira_issue_key="EVCP-777"
    )
    db.add(sync_task)
    db.commit()
    db.refresh(sync_task)
    task_id = sync_task.id
    db.close()

    # Trigger manual sync
    resp = client.post(f"/api/tasks/{task_id}/jira/sync")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "synchronized_from_jira"
    assert data["new_status"] == "RESOLVED"

    # Clean up
    db = SessionLocal()
    del_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if del_task:
        db.delete(del_task)
        db.commit()
    db.close()
