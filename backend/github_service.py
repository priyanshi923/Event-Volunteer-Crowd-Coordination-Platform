import json
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

# Search for .env files automatically (same lookup as jira_service)
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

API = "https://api.github.com"
# Unauthenticated GitHub API calls are limited to 60/hour per IP, so cache run listings.
RUNS_CACHE_SECONDS = 30


class GitHubActionsService:
    """
    Connects the running platform to GitHub Actions.

    Reads workflow runs (works without a token for public repositories) and dispatches the
    `runtime-report.yml` workflow with a live snapshot of the platform (needs GITHUB_TOKEN with
    Actions: write on the repository).
    """

    def __init__(self):
        self._cache: Optional[Dict[str, Any]] = None
        self._cache_at = 0.0
        self._lock = threading.Lock()
        self.last_dispatch: Optional[Dict[str, Any]] = None
        self.reload_config()

    def reload_config(self):
        self.repository = os.environ.get("GITHUB_REPOSITORY", "priyanshi923/Event-Volunteer-Crowd-Coordination-Platform").strip("/")
        self.token = os.environ.get("GITHUB_TOKEN", "")
        self.workflow = os.environ.get("GITHUB_RUNTIME_WORKFLOW", "runtime-report.yml")
        self.ref = os.environ.get("GITHUB_WORKFLOW_REF", "main")
        self.source = os.environ.get("EVCP_INSTANCE_NAME", "local-dev")
        self.report_on_startup = os.environ.get("GITHUB_REPORT_ON_STARTUP", "true").lower() in ("1", "true", "yes")
        self.heartbeat_minutes = float(os.environ.get("GITHUB_REPORT_INTERVAL_MIN", "0") or 0)
        self.enabled = bool(self.repository)
        self.can_dispatch = bool(self.repository and self.token)

    def _headers(self) -> Dict[str, str]:
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def repo_url(self) -> str:
        return f"https://github.com/{self.repository}"

    def list_runs(self, limit: int = 8, force: bool = False) -> Dict[str, Any]:
        """Recent workflow runs across all workflows, newest first."""
        with self._lock:
            if not force and self._cache and time.time() - self._cache_at < RUNS_CACHE_SECONDS:
                return self._cache
        url = f"{API}/repos/{self.repository}/actions/runs"
        try:
            r = requests.get(url, headers=self._headers(), params={"per_page": limit}, timeout=10)
        except Exception as e:
            return {"ok": False, "error": f"GitHub unreachable: {e.__class__.__name__}", "runs": []}
        if r.status_code != 200:
            msg = r.json().get("message", r.text[:200]) if r.headers.get("content-type", "").startswith("application/json") else r.text[:200]
            return {"ok": False, "error": f"GitHub API {r.status_code}: {msg}", "runs": []}
        runs = [
            {
                "id": run["id"],
                "name": run.get("name"),
                "title": run.get("display_title"),
                "workflow_path": run.get("path"),
                "event": run.get("event"),
                "branch": run.get("head_branch"),
                "sha": (run.get("head_sha") or "")[:7],
                "status": run.get("status"),
                "conclusion": run.get("conclusion"),
                "created_at": run.get("created_at"),
                "updated_at": run.get("updated_at"),
                "url": run.get("html_url"),
            }
            for run in r.json().get("workflow_runs", [])
        ]
        result = {
            "ok": True,
            "runs": runs,
            "rate_limit_remaining": r.headers.get("x-ratelimit-remaining"),
        }
        with self._lock:
            self._cache, self._cache_at = result, time.time()
        return result

    def dispatch_report(self, event: str, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        """Trigger the runtime-report workflow on GitHub Actions with a platform snapshot."""
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        if not self.can_dispatch:
            result = {"ok": False, "event": event, "at": now, "error": "GITHUB_TOKEN is not configured"}
            self.last_dispatch = result
            return result
        url = f"{API}/repos/{self.repository}/actions/workflows/{self.workflow}/dispatches"
        payload = {
            "ref": self.ref,
            "inputs": {
                "event": event,
                "source": self.source,
                # workflow_dispatch inputs are strings; the workflow parses this JSON.
                "snapshot": json.dumps(snapshot, default=str, separators=(",", ":")),
            },
        }
        try:
            r = requests.post(url, headers=self._headers(), json=payload, timeout=12)
        except Exception as e:
            result = {"ok": False, "event": event, "at": now, "error": f"GitHub unreachable: {e.__class__.__name__}"}
        else:
            if r.status_code in (200, 204):
                result = {"ok": True, "event": event, "at": now}
                with self._lock:
                    self._cache = None  # next listing should show the new run
            else:
                try:
                    msg = r.json().get("message", "")
                except ValueError:
                    msg = r.text[:200]
                result = {"ok": False, "event": event, "at": now, "error": f"GitHub API {r.status_code}: {msg}"}
        print(f"[GitHub Actions] dispatch '{event}' -> {'ok' if result['ok'] else result['error']}")
        self.last_dispatch = result
        return result

    def status(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "canDispatch": self.can_dispatch,
            "repository": self.repository,
            "repositoryUrl": self.repo_url(),
            "workflow": self.workflow,
            "workflowUrl": f"{self.repo_url()}/actions/workflows/{self.workflow}",
            "ref": self.ref,
            "source": self.source,
            "heartbeatMinutes": self.heartbeat_minutes,
            "lastDispatch": self.last_dispatch,
        }


github_service = GitHubActionsService()
