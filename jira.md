# TASK: Implement REAL Two-Way Live Jira Synchronization in EVCP

You are working on my existing project:

**Event Volunteer & Crowd Coordination Platform (EVCP)**

Repository:
`event-volunteer-platform`

Jira project:

* Project name: `EVCP — Event Volunteer & Crowd Coordination Platform`
* Project key: `EVCP`
* Jira board already exists
* Workflow:

  * `TO DO`
  * `IN PROGRESS`
  * `DONE`

## PRIMARY GOAL

I need a **REAL, WORKING, TWO-WAY Jira integration**.

Do NOT create a fake Jira UI, mock synchronization, hardcoded status changes, or a simulated board.

The existing EVCP application's task/volunteer-workflow UI must communicate with the **real Jira project through Jira REST APIs**.

The final demo must allow my teacher to see that changes made in the EVCP application actually appear in Jira.

---

# REQUIRED BEHAVIOR

## 1. EVCP → Jira

When a user changes a task's status in the EVCP application:

### EVCP:

`TO DO`
→ user moves task to
`IN PROGRESS`

The backend must make a real Jira REST API request and transition the corresponding Jira issue to:

`IN PROGRESS`

Similarly:

`IN PROGRESS`
→ `DONE`

must transition the real Jira issue to:

`DONE`

And:

`DONE`
→ `IN PROGRESS`

must transition Jira back to `IN PROGRESS` if the Jira workflow permits it.

Do NOT simply update the local database and pretend Jira changed.

---

# 2. Jira → EVCP

Implement reverse synchronization as well.

If I open the real Jira board and manually move:

`EVCP-XX`

from:

`TO DO`
→ `IN PROGRESS`

the EVCP application should be able to retrieve/synchronize that Jira status and display:

`IN PROGRESS`

for the corresponding EVCP task.

Use a proper mechanism such as:

* Jira webhook if practical, OR
* a backend synchronization endpoint/polling mechanism

Prefer a Jira webhook for real-time synchronization if it can be implemented reliably with the current architecture.

If a public webhook endpoint is impossible in the local development environment, implement a reliable backend sync/poll mechanism and document the limitation.

---

# 3. REAL JIRA ISSUES

Every EVCP task that is synchronized with Jira must have a real Jira issue.

For example:

EVCP task:

`Assign volunteers to Zone A`

should correspond to something like:

`EVCP-15`

in Jira.

The mapping must be persistent.

Do NOT rely only on matching task names.

Store the Jira issue key/ID in the EVCP backend database/model.

Example concept:

```text
EVCP Task
--------------------------
id
title
description
status
jiraIssueKey
jiraIssueId
...
```

Adapt this to the existing database/model rather than blindly creating a new schema.

---

# 4. CREATE JIRA ISSUES

If an EVCP task does not yet have a Jira issue, provide a backend operation to create/link the corresponding Jira issue.

For example:

```text
POST /api/tasks/:id/jira/sync
```

or an appropriate endpoint based on the existing API architecture.

The operation should:

1. Check whether the task already has a Jira issue.
2. If yes, update/synchronize it.
3. If no, create a real Jira issue in project `EVCP`.
4. Save the Jira issue key and ID in the EVCP database.
5. Return the Jira issue information.

Do not create duplicate Jira issues on repeated synchronization.

---

# 5. STATUS MAPPING

Implement a clear mapping between EVCP statuses and Jira statuses.

Expected mapping:

```text
EVCP TODO          ↔ Jira TO DO
EVCP IN_PROGRESS   ↔ Jira IN PROGRESS
EVCP DONE          ↔ Jira DONE
```

Do not assume Jira transition IDs.

Retrieve the actual available Jira transitions for each issue using Jira's REST API and select the appropriate transition by status name.

For example, conceptually:

```text
GET /rest/api/3/issue/{issueKey}/transitions
```

Find the transition whose destination status matches the desired status.

Then execute the real transition.

This must work with the actual workflow configured in the `EVCP` Jira project.

---

# 6. JIRA AUTHENTICATION

Use environment variables.

NEVER hard-code:

* Jira email
* Jira API token
* Jira domain

Add/update `.env.example` with placeholders such as:

```env
JIRA_BASE_URL=https://YOUR-DOMAIN.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=EVCP
```

The real `.env` must remain ignored by Git.

Check `.gitignore` and make sure:

```text
.env
```

is ignored.

Do not print the Jira API token in logs.

Do not expose the API token to the frontend.

All Jira API communication must happen through the backend.

---

# 7. BACKEND ARCHITECTURE

First inspect the existing backend.

Do NOT create a second backend.

Integrate Jira into the existing backend architecture.

Create a clean Jira service/module, for example:

```text
backend/
  ...
  services/
    jiraService.*
```

or follow the project's existing architecture.

The Jira service should handle things such as:

```text
createIssue()
getIssue()
getTransitions()
transitionIssue()
updateIssue()
syncIssue()
```

Use the HTTP/client technology already used by the project whenever practical.

---

# 8. FRONTEND

Update the existing EVCP task/Kanban UI.

Do NOT replace the existing UI with a separate application.

Each task should clearly indicate whether it is linked to Jira.

For example:

```text
Assign Volunteers

Status:
IN PROGRESS

Jira:
EVCP-15

[Open in Jira]
[Sync]
```

The exact UI should match the existing application's design.

When the user changes the task status through the EVCP UI:

1. Update the EVCP backend.
2. Backend updates Jira.
3. Return the synchronized result.
4. Update the UI.
5. Show a success/error notification.

Example:

```text
Status changed to IN PROGRESS
✓ Jira EVCP-15 synchronized
```

If Jira synchronization fails, do not silently pretend it succeeded.

Show something like:

```text
EVCP status updated locally, but Jira synchronization failed.
```

and log the useful error server-side without exposing secrets.

---

# 9. JIRA LINK

Provide an "Open in Jira" link for linked issues.

The frontend should receive the issue URL from the backend or construct it safely from the configured Jira base URL.

Example:

```text
https://YOUR-DOMAIN.atlassian.net/browse/EVCP-15
```

Do not hard-code a fake URL.

---

# 10. TWO-WAY SYNCHRONIZATION DESIGN

Implement a robust synchronization mechanism.

Preferred:

```text
                    ┌───────────────┐
                    │  EVCP Frontend│
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ EVCP Backend  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Jira REST API│
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Real Jira    │
                    │  EVCP Board   │
                    └───────────────┘
                            │
                         Webhook
                            │
                            ▼
                    ┌───────────────┐
                    │ EVCP Backend  │
                    └───────────────┘
```

Avoid infinite synchronization loops.

For example:

```text
EVCP → Jira
```

causes a Jira webhook.

The webhook must recognize that the change originated from EVCP and must not repeatedly update the same issue.

Implement suitable safeguards/idempotency.

---

# 11. WEBHOOK

If implementing Jira webhook:

Create an endpoint such as:

```text
POST /api/jira/webhook
```

It must:

1. Receive Jira webhook events.
2. Identify the Jira issue.
3. Find the linked EVCP task using the stored Jira issue key/ID.
4. Read the Jira status.
5. Convert it to the EVCP status.
6. Update the EVCP database.
7. Return a successful response.

Handle irrelevant Jira events safely.

Do not expose unnecessary sensitive information in webhook responses/logs.

If Jira Cloud requires a publicly accessible URL and localhost prevents testing, provide a development-compatible approach and explain exactly how to test it.

---

# 12. SYNC ENDPOINT

Also provide a manual synchronization endpoint as a reliable fallback/testing mechanism.

For example:

```text
POST /api/jira/sync
```

or appropriate REST structure.

It should synchronize linked issues between EVCP and Jira.

Also provide:

```text
GET /api/jira/status
```

or equivalent health/status endpoint so I can verify that Jira credentials/configuration are working.

The endpoint must return useful information such as:

```json
{
  "connected": true,
  "projectKey": "EVCP"
}
```

Never return the API token.

---

# 13. DATABASE

Inspect the existing database and migration system first.

Do not unnecessarily redesign the database.

Add only the fields/tables needed for Jira integration.

Potential fields:

```text
jiraIssueKey
jiraIssueId
jiraSyncedAt
```

Use the project's existing ORM/database conventions.

Create a proper migration if the project uses migrations.

---

# 14. DOCKER

The existing project runs using Docker/Docker Compose.

Make sure Jira integration works inside the existing Docker environment.

Do not break:

```text
docker compose up
```

The backend container must receive the Jira environment variables.

Update:

```text
docker-compose.yml
```

only where necessary.

Update:

```text
.env.example
```

with the required configuration.

Never put the real API token into `docker-compose.yml`.

---

# 15. ERROR HANDLING

Handle:

* Invalid Jira credentials
* Jira project not found
* Issue not found
* Invalid transition
* Jira API timeout
* Jira API rate limiting
* Network failure
* Missing Jira configuration
* Duplicate issue creation
* Webhook for unknown issue
* Unsupported status

The application must remain usable if Jira is temporarily unavailable.

Errors must be meaningful.

---

# 16. DO NOT FAKE ANYTHING

This is extremely important.

Do NOT:

* create a fake Jira board
* create mock Jira responses
* hard-code Jira issue keys
* hard-code transition IDs
* pretend an API call succeeded
* store a fake Jira status locally
* create screenshots instead of integration
* create a simulated "Jira connected" indicator
* use static JSON pretending to be Jira
* replace the real Jira board with an EVCP-only Kanban

The final system must communicate with the real Jira Cloud project.

---

# 17. TESTING

After implementation, test the complete workflow.

### Test A — EVCP → Jira

Create/link a real Jira issue:

```text
EVCP-XX
```

Then in EVCP:

```text
TO DO → IN PROGRESS
```

Verify through Jira REST API and/or the actual Jira UI that:

```text
EVCP-XX = IN PROGRESS
```

Then:

```text
IN PROGRESS → DONE
```

Verify:

```text
EVCP-XX = DONE
```

### Test B — Jira → EVCP

In the real Jira board:

```text
EVCP-XX
DONE → IN PROGRESS
```

Then synchronize through the implemented webhook/sync mechanism.

Verify EVCP displays:

```text
IN PROGRESS
```

### Test C — Persistence

Restart the backend/containers.

Verify the Jira issue mapping still exists.

### Test D — Duplicate protection

Synchronize the same task multiple times.

Verify that multiple Jira issues are NOT created.

### Test E — Docker

Run:

```bash
docker compose up --build
```

Verify all required services start successfully.

---

# 18. AUTOMATED TESTS

Add tests for the Jira integration where the project's existing test framework supports them.

At minimum test:

* status mapping
* Jira issue creation logic
* Jira transition logic
* synchronization
* duplicate prevention
* webhook processing
* missing configuration/error handling

Use mocked Jira API responses for unit tests where appropriate, but the actual application integration must use the real Jira API.

---

# 19. DOCUMENTATION

Update the project documentation with a section:

# Live Jira Integration

Explain:

1. Jira project/key
2. Required environment variables
3. How to create/configure Jira API credentials
4. How Jira issue mapping works
5. EVCP → Jira synchronization
6. Jira → EVCP synchronization
7. Webhook configuration
8. Local development testing
9. Docker testing
10. Troubleshooting

Include example commands, but NEVER include real credentials.

---

# 20. FINAL DEMO REQUIREMENT

The final application must support this teacher demonstration:

### Demo 1

Open:

```text
EVCP application
```

Show a task:

```text
Assign Volunteers
TO DO
```

Move it to:

```text
IN PROGRESS
```

Then immediately open the real Jira board and show:

```text
EVCP-XX
IN PROGRESS
```

### Demo 2

Move the same task in EVCP:

```text
IN PROGRESS → DONE
```

Show Jira changing to:

```text
DONE
```

### Demo 3

Move the issue directly in the real Jira board:

```text
DONE → IN PROGRESS
```

Then show EVCP reflecting:

```text
IN PROGRESS
```

This must be a real end-to-end demonstration.

---

# 21. IMPORTANT: INSPECT BEFORE MODIFYING

Before changing code:

1. Inspect the complete repository structure.
2. Identify frontend framework.
3. Identify backend framework.
4. Identify database/ORM.
5. Identify existing task model.
6. Identify existing Kanban/status implementation.
7. Identify existing API endpoints.
8. Identify Docker architecture.
9. Identify current environment configuration.
10. Identify the best integration points.

Then implement Jira integration using the existing architecture.

Do not unnecessarily rewrite working parts of the application.

---

# 22. AFTER IMPLEMENTATION

Do not just tell me "implemented".

Actually verify the implementation.

Provide me with:

### A. Files changed

List every file created/modified.

### B. Architecture

Explain briefly:

```text
EVCP UI
↓
Backend
↓
Jira Service
↓
Jira REST API
↓
Real Jira
```

and the reverse path.

### C. Environment variables

Tell me exactly what I need to add to my local `.env`.

Use placeholders only.

### D. Jira setup

Tell me exactly what I need to configure in Jira, including webhook setup if required.

### E. Run commands

Give the exact commands to start the project.

### F. Test procedure

Give me an exact step-by-step test:

```text
1. Open EVCP
2. Open Jira
3. Select EVCP-XX
4. Change EVCP status
5. Refresh/check Jira
6. Change Jira status
7. Check EVCP
```

### G. Verification

Run/build/test the project and report any problems.

If something cannot be fully implemented because of a Jira Cloud limitation, tell me clearly instead of pretending it works.

## FINAL SUCCESS CONDITION

I should be able to stand in front of my teacher and demonstrate:

**EVCP application ↔ REAL Jira board**

with actual live status synchronization.

The Jira board must be the real Jira project `EVCP`, not a mock or simulated board.
