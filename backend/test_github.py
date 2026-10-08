import json
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

from main import app
from github_service import GitHubActionsService, github_service

client = TestClient(app)


def _response(status_code, body=None, headers=None):
    r = MagicMock()
    r.status_code = status_code
    r.json.return_value = body or {}
    r.text = json.dumps(body or {})
    r.headers = {"content-type": "application/json", **(headers or {})}
    return r


# ---------------------------------------------------------
# Test 1: Status endpoint lists runs and never leaks the token
# ---------------------------------------------------------
@patch("github_service.requests.get")
def test_github_status_lists_runs(mock_get):
    mock_get.return_value = _response(200, {"workflow_runs": [{
        "id": 1, "name": "EVCP CI/CD", "display_title": "ci fix", "path": ".github/workflows/ci.yml",
        "event": "push", "head_branch": "main", "head_sha": "abcdef123456", "status": "completed",
        "conclusion": "success", "created_at": "2026-10-08T00:00:00Z", "updated_at": "2026-10-08T00:05:00Z",
        "html_url": "https://github.com/o/r/actions/runs/1",
    }]}, {"x-ratelimit-remaining": "59"})
    with patch.object(github_service, "token", "secret-token-value"), patch.object(github_service, "_cache", None):
        resp = client.get("/api/github/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["runsOk"] is True
    assert data["runs"][0]["conclusion"] == "success"
    assert data["runs"][0]["sha"] == "abcdef1"
    assert "secret-token-value" not in resp.text


# ---------------------------------------------------------
# Test 2: Manual report requires a token
# ---------------------------------------------------------
def test_report_without_token_is_rejected():
    with patch.object(github_service, "can_dispatch", False):
        resp = client.post("/api/github/report")
    assert resp.status_code == 400
    assert "GITHUB_TOKEN" in resp.json()["detail"]


# ---------------------------------------------------------
# Test 3: Manual report dispatches the workflow with a JSON snapshot
# ---------------------------------------------------------
@patch("github_service.requests.post")
def test_report_dispatches_workflow(mock_post):
    mock_post.return_value = _response(204)
    with patch.object(github_service, "can_dispatch", True), patch.object(github_service, "token", "t"):
        resp = client.post("/api/github/report")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    url = mock_post.call_args.args[0]
    body = mock_post.call_args.kwargs["json"]
    assert url.endswith(f"/actions/workflows/{github_service.workflow}/dispatches")
    assert body["ref"] == github_service.ref
    assert body["inputs"]["event"] == "manual"
    snapshot = json.loads(body["inputs"]["snapshot"])
    assert "total_volunteers" in snapshot and "open_issues" in snapshot
    assert mock_post.call_args.kwargs["headers"]["Authorization"] == "Bearer t"


# ---------------------------------------------------------
# Test 4: GitHub API errors surface as 502 with the message
# ---------------------------------------------------------
@patch("github_service.requests.post")
def test_report_surfaces_github_errors(mock_post):
    mock_post.return_value = _response(404, {"message": "Not Found"})
    with patch.object(github_service, "can_dispatch", True), patch.object(github_service, "token", "t"):
        resp = client.post("/api/github/report")
    assert resp.status_code == 502
    assert "404" in resp.json()["detail"]


# ---------------------------------------------------------
# Test 5: Config — dispatch only possible with a token
# ---------------------------------------------------------
def test_config_from_env(monkeypatch):
    monkeypatch.setenv("GITHUB_REPOSITORY", "octo/repo")
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    svc = GitHubActionsService()
    assert svc.enabled and not svc.can_dispatch
    monkeypatch.setenv("GITHUB_TOKEN", "x")
    svc.reload_config()
    assert svc.can_dispatch
    assert svc.status()["workflowUrl"] == "https://github.com/octo/repo/actions/workflows/runtime-report.yml"
