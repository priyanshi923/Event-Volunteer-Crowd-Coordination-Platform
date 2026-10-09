"""
Local Jira Cloud simulator for EVCP.

Implements the subset of the Jira REST API v3 that backend/jira_service.py calls,
so the real integration code paths (create, get, transitions, project check,
webhook push-back) run end to end without an Atlassian account.

Run:
    python simulation/jira_simulator.py            # serves on http://127.0.0.1:8090

Then point the backend at it (backend/.env):
    JIRA_BASE_URL=http://127.0.0.1:8090
    JIRA_USER_EMAIL=simulator@evcp.local
    JIRA_API_TOKEN=local-simulator-token
    JIRA_PROJECT_KEY=EVCP

Open http://127.0.0.1:8090 for a board view. Moving a card there fires the same
"issue updated" webhook Jira Cloud would send to EVCP_WEBHOOK_URL.
"""
import json
import os
import threading
from datetime import datetime, timezone
from html import escape

import requests
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse

PORT = int(os.environ.get("JIRA_SIM_PORT", "8090"))
PROJECT_KEY = os.environ.get("JIRA_PROJECT_KEY", "EVCP")
WEBHOOK_URL = os.environ.get("EVCP_WEBHOOK_URL", "http://127.0.0.1:8000/api/jira/webhook")
STORE_PATH = os.path.join(os.path.dirname(__file__), "jira_sim_store.json")

STATUSES = {
    "10000": {"id": "10000", "name": "To Do", "category": "new"},
    "10001": {"id": "10001", "name": "In Progress", "category": "indeterminate"},
    "10002": {"id": "10002", "name": "Done", "category": "done"},
}
# Transition id -> target status id (any status can move to any other, like a simplified Jira workflow)
TRANSITIONS = {"11": "10000", "21": "10001", "31": "10002"}
PRIORITIES = {"1": "Highest", "2": "High", "3": "Medium", "4": "Low", "5": "Lowest"}

_lock = threading.Lock()
app = FastAPI(title="Jira Cloud Simulator", version="1.0.0")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000+0000")


def _load() -> dict:
    if os.path.exists(STORE_PATH):
        with open(STORE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {"next_number": 1, "next_id": 10000, "issues": {}}


def _save(store: dict) -> None:
    with open(STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)


def _require_auth(request: Request) -> None:
    if not request.headers.get("authorization", "").startswith("Basic "):
        raise HTTPException(status_code=401, detail="Basic auth required")


def _issue_json(request: Request, issue: dict) -> dict:
    status = STATUSES[issue["status_id"]]
    return {
        "id": issue["id"],
        "key": issue["key"],
        "self": f"{request.base_url}rest/api/3/issue/{issue['id']}",
        "fields": {
            "summary": issue["summary"],
            "description": issue["description"],
            "issuetype": {"name": issue["issuetype"]},
            "priority": {"id": issue["priority_id"], "name": PRIORITIES.get(issue["priority_id"], "Medium")},
            "project": {"key": PROJECT_KEY},
            "status": {"id": status["id"], "name": status["name"], "statusCategory": {"key": status["category"]}},
            "created": issue["created"],
            "updated": issue["updated"],
        },
    }


def _find(store: dict, key_or_id: str) -> dict:
    issue = store["issues"].get(key_or_id)
    if not issue:
        issue = next((i for i in store["issues"].values() if i["id"] == key_or_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail={"errorMessages": ["Issue does not exist or you do not have permission to see it."]})
    return issue


def _fire_webhook(issue_payload: dict, from_status: str, to_status: str) -> None:
    body = {
        "webhookEvent": "jira:issue_updated",
        "issue": issue_payload,
        "changelog": {"items": [{"field": "status", "fromString": from_status, "toString": to_status}]},
    }
    try:
        r = requests.post(WEBHOOK_URL, json=body, timeout=5)
        print(f"[Jira Sim] webhook -> {WEBHOOK_URL}: {r.status_code} {r.text[:160]}")
    except Exception as e:
        print(f"[Jira Sim] webhook delivery failed: {e}")


# ----------------------------- REST API v3 -----------------------------

@app.get("/rest/api/3/myself")
def myself(request: Request):
    _require_auth(request)
    return {"accountId": "sim-user", "displayName": "EVCP Simulator", "active": True}


@app.get("/rest/api/3/project/{key}")
def get_project(key: str, request: Request):
    _require_auth(request)
    if key != PROJECT_KEY:
        raise HTTPException(status_code=404, detail={"errorMessages": [f"No project could be found with key '{key}'."]})
    return {"id": "10000", "key": PROJECT_KEY, "name": "EVCP — Event Volunteer & Crowd Coordination Platform", "projectTypeKey": "software"}


@app.post("/rest/api/3/issue", status_code=201)
async def create_issue(request: Request):
    _require_auth(request)
    fields = (await request.json()).get("fields", {})
    if fields.get("project", {}).get("key") != PROJECT_KEY:
        raise HTTPException(status_code=400, detail={"errors": {"project": "valid project is required"}})
    if not fields.get("summary"):
        raise HTTPException(status_code=400, detail={"errors": {"summary": "You must specify a summary of the issue."}})
    with _lock:
        store = _load()
        key = f"{PROJECT_KEY}-{store['next_number']}"
        issue_id = str(store["next_id"])
        store["next_number"] += 1
        store["next_id"] += 1
        store["issues"][key] = {
            "id": issue_id,
            "key": key,
            "summary": fields["summary"],
            "description": fields.get("description"),
            "issuetype": fields.get("issuetype", {}).get("name", "Task"),
            "priority_id": fields.get("priority", {}).get("id", "3"),
            "status_id": "10000",
            "created": _now(),
            "updated": _now(),
        }
        _save(store)
    print(f"[Jira Sim] created {key}: {fields['summary']}")
    return {"id": issue_id, "key": key, "self": f"{request.base_url}rest/api/3/issue/{issue_id}"}


@app.get("/rest/api/3/issue/{key}")
def get_issue(key: str, request: Request):
    _require_auth(request)
    return _issue_json(request, _find(_load(), key))


@app.get("/rest/api/3/issue/{key}/transitions")
def get_transitions(key: str, request: Request):
    _require_auth(request)
    issue = _find(_load(), key)
    return {
        "transitions": [
            {"id": tid, "name": STATUSES[sid]["name"], "to": {"id": sid, "name": STATUSES[sid]["name"]}}
            for tid, sid in TRANSITIONS.items()
            if sid != issue["status_id"]
        ]
    }


@app.post("/rest/api/3/issue/{key}/transitions", status_code=204)
async def do_transition(key: str, request: Request):
    _require_auth(request)
    tid = (await request.json()).get("transition", {}).get("id")
    if tid not in TRANSITIONS:
        raise HTTPException(status_code=400, detail={"errorMessages": [f"Transition id '{tid}' is not valid for this issue."]})
    with _lock:
        store = _load()
        issue = _find(store, key)
        old = STATUSES[issue["status_id"]]["name"]
        issue["status_id"] = TRANSITIONS[tid]
        issue["updated"] = _now()
        _save(store)
    print(f"[Jira Sim] {issue['key']}: {old} -> {STATUSES[issue['status_id']]['name']} (via API)")
    return Response(status_code=204)


@app.get("/rest/api/3/search/jql")
def search(request: Request):
    _require_auth(request)
    return {"issues": [_issue_json(request, i) for i in _load()["issues"].values()], "isLast": True}


# ----------------------------- Board UI -----------------------------
# Moving a card here simulates a person dragging it on the real Jira board.

@app.post("/board/{key}/move/{status_id}")
def board_move(key: str, status_id: str, request: Request):
    if status_id not in STATUSES:
        raise HTTPException(status_code=400, detail="Unknown status")
    with _lock:
        store = _load()
        issue = _find(store, key)
        old = STATUSES[issue["status_id"]]["name"]
        issue["status_id"] = status_id
        issue["updated"] = _now()
        _save(store)
        payload = _issue_json(request, issue)
    new = STATUSES[status_id]["name"]
    print(f"[Jira Sim] {key}: {old} -> {new} (board)")
    if old != new:
        threading.Thread(target=_fire_webhook, args=(payload, old, new), daemon=True).start()
    return RedirectResponse(url=f"/#{key}", status_code=303)


@app.get("/browse/{key}")
def browse(key: str):
    return RedirectResponse(url=f"/#{key}")


@app.get("/", response_class=HTMLResponse)
def board():
    issues = list(_load()["issues"].values())
    cols = []
    for sid, st in STATUSES.items():
        cards = []
        for i in sorted((i for i in issues if i["status_id"] == sid), key=lambda i: int(i["id"]), reverse=True):
            buttons = "".join(
                f'<form method="post" action="/board/{escape(i["key"])}/move/{osid}"><button>&rarr; {escape(ost["name"])}</button></form>'
                for osid, ost in STATUSES.items() if osid != sid
            )
            cards.append(
                f'<div class="card" id="{escape(i["key"])}"><div class="key">{escape(i["key"])} · {PRIORITIES.get(i["priority_id"], "Medium")}</div>'
                f'<div class="sum">{escape(i["summary"])}</div><div class="act">{buttons}</div></div>'
            )
        cols.append(f'<section><h2>{st["name"]} <span>{len(cards)}</span></h2>{"".join(cards) or "<p class=empty>No issues</p>"}</section>')
    return f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EVCP Jira Board (Simulator)</title><meta http-equiv="refresh" content="10">
<style>
body{{font-family:system-ui,sans-serif;margin:0;background:#f4f5f7;color:#172b4d}}
header{{background:#0052cc;color:#fff;padding:12px 20px}} header small{{opacity:.8}}
main{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;padding:20px}}
section{{background:#ebecf0;border-radius:6px;padding:10px}} h2{{font-size:13px;text-transform:uppercase;color:#5e6c84;margin:4px 6px 10px}}
h2 span{{background:#dfe1e6;border-radius:10px;padding:1px 7px;margin-left:4px}}
.card{{background:#fff;border-radius:4px;padding:10px;margin-bottom:8px;box-shadow:0 1px 1px #091e4240}} .card:target{{outline:2px solid #0052cc}}
.key{{font-size:12px;color:#5e6c84}} .sum{{margin:6px 0}} .act{{display:flex;gap:6px;flex-wrap:wrap}}
button{{font-size:12px;border:1px solid #c1c7d0;background:#fafbfc;border-radius:3px;padding:3px 8px;cursor:pointer}}
.empty{{color:#7a869a;font-size:13px;margin:6px}}
</style></head><body><header><b>Jira Software (Local Simulator)</b> — project {PROJECT_KEY} <small>· webhooks → {escape(WEBHOOK_URL)} · auto-refresh 10s</small></header>
<main>{"".join(cols)}</main></body></html>"""


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
