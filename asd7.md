# Experiment 6 — Agile Project Management Using Jira

## Project

Event Volunteer & Crowd Coordination Platform — DevOps Enabled

## Objective

Prepare the existing Event Volunteer & Crowd Coordination Platform for **Experiment 6: Agile Software Development using Jira**.

The objective is to demonstrate:

* Agile methodology
* Scrum framework
* Epics
* User Stories
* Tasks
* Subtasks
* Bugs
* Sprint planning
* Sprint execution
* Scrum/Kanban board
* Backlog management
* Story points
* Priorities
* Workflow from To Do → In Progress → Testing → Done
* Sprint progress/reporting

IMPORTANT:

This experiment is primarily a **Jira project-management activity**.

Do NOT redesign, rewrite, or add features to the application.

Do NOT modify the working backend/frontend unless absolutely required for documentation.

---

# 1. Inspect the existing project

First inspect the current EVCP project and understand the features that have already been implemented.

Use the actual existing functionality as the basis for Jira work items.

The application currently includes concepts such as:

* Event management
* Zones
* Volunteer management
* Volunteer skills
* Availability
* Shift/task management
* Skill-based volunteer assignment
* Conflict detection
* Preference scoring
* Fair workload
* Attendance/check-in
* Issue reporting
* Issue escalation
* Coordinator dashboard
* Docker
* Docker Compose
* CI/CD
* Prometheus
* Grafana
* Testing

Do not invent major application features that do not exist.

---

# 2. Jira project structure

Create/prepare a Jira project named:

```text
EVCP — Event Volunteer & Crowd Coordination Platform
```

Use a Scrum project/board as the primary project structure.

Recommended key:

```text
EVCP
```

If Jira does not allow this exact key, use the closest available key.

---

# 3. Agile Epics

Create the following Epics:

### EPIC 1 — Project Foundation

Description:

Set up the basic backend, frontend, database, repository and project structure.

### EPIC 2 — Event Management

Description:

Implement event creation, zones and event configuration.

### EPIC 3 — Volunteer Management

Description:

Manage volunteers, skills, availability and preferences.

### EPIC 4 — Intelligent Assignment

Description:

Automatically assign volunteers to shifts/tasks using skills, availability, conflicts, preferences and fairness.

### EPIC 5 — Attendance & Operations

Description:

Track volunteer attendance, check-in/out, shifts and operational activity.

### EPIC 6 — Issue Management & Escalation

Description:

Report operational issues and escalate unresolved/high-priority issues.

### EPIC 7 — Coordinator Dashboard

Description:

Provide visibility into event operations, volunteers, zones, shifts and issues.

### EPIC 8 — DevOps & Deployment

Description:

Implement Git, Docker, Docker Compose, CI/CD and deployment.

### EPIC 9 — Monitoring

Description:

Implement application and infrastructure monitoring using Prometheus and Grafana.

---

# 4. User Stories

Create realistic User Stories under the appropriate Epics.

Use the format:

```text
As a <user>,
I want <functionality>,
so that <benefit>.
```

Create at least the following.

---

## Project Foundation

### Story: Backend Setup

As a developer,

I want to set up the backend application,

so that the platform can provide API services.

Suggested story points: 3

Priority: High

---

### Story: Frontend Setup

As a developer,

I want to set up the frontend application,

so that organizers can interact with the platform.

Suggested story points: 3

Priority: High

---

### Story: Database Setup

As a developer,

I want to configure the application database,

so that event and volunteer information can be stored.

Suggested story points: 3

Priority: High

---

# Event Management

### Story: Create Event

As an event organizer,

I want to create an event,

so that I can manage its volunteers and operations.

Story points: 5

Priority: High

---

### Story: Configure Event Zones

As an event organizer,

I want to define zones such as Entry Gate, Registration, Stage, Parking and First Aid,

so that volunteers can be assigned to specific areas.

Story points: 5

Priority: High

---

# Volunteer Management

### Story: Add Volunteers

As an event organizer,

I want to add volunteers,

so that they can participate in event operations.

Story points: 5

Priority: High

---

### Story: Manage Volunteer Skills

As an event organizer,

I want to record volunteer skills,

so that volunteers can be assigned to suitable tasks.

Story points: 5

Priority: High

---

### Story: Manage Availability

As an event organizer,

I want to record volunteer availability,

so that volunteers are assigned only during available periods.

Story points: 5

Priority: High

---

# Intelligent Assignment

### Story: Skill-Based Assignment

As a coordinator,

I want volunteers to be assigned according to required skills,

so that tasks are handled by suitable volunteers.

Story points: 8

Priority: Highest

---

### Story: Prevent Shift Conflicts

As a coordinator,

I want overlapping volunteer shifts to be detected,

so that a volunteer is not assigned to conflicting shifts.

Story points: 5

Priority: High

---

### Story: Fair Workload Distribution

As a coordinator,

I want assignments to consider volunteer workload,

so that work is distributed fairly.

Story points: 5

Priority: Medium

---

# Attendance & Operations

### Story: Volunteer Check-In

As a coordinator,

I want to record volunteer check-in,

so that I know who is currently available at the event.

Story points: 5

Priority: High

---

### Story: Volunteer Check-Out

As a coordinator,

I want to record volunteer check-out,

so that attendance and working hours can be tracked.

Story points: 3

Priority: Medium

---

# Issue Management

### Story: Report Operational Issue

As a coordinator,

I want to report operational issues,

so that problems can be tracked and resolved.

Story points: 5

Priority: High

---

### Story: Escalate Critical Issues

As an event coordinator,

I want unresolved critical issues to be escalated,

so that important problems receive timely attention.

Story points: 8

Priority: Highest

---

# Dashboard

### Story: Event Operations Dashboard

As an organizer,

I want to view event operations from a dashboard,

so that I can monitor volunteers, zones, shifts and issues.

Story points: 8

Priority: High

---

# DevOps

### Story: Containerize Application

As a developer,

I want to containerize the application,

so that it can run consistently across environments.

Story points: 5

Priority: High

---

### Story: Automate CI

As a developer,

I want automated testing and Docker builds,

so that code quality is verified before deployment.

Story points: 5

Priority: High

---

### Story: Automate Deployment

As a developer,

I want successful builds to be automatically deployed,

so that application updates require minimal manual intervention.

Story points: 5

Priority: High

---

# Monitoring

### Story: Application Monitoring

As an administrator,

I want application metrics to be collected,

so that system health can be monitored.

Story points: 5

Priority: High

---

### Story: Monitoring Dashboard

As an administrator,

I want Grafana dashboards,

so that application and infrastructure metrics can be visualized.

Story points: 5

Priority: High

---

# 5. Tasks and Subtasks

For selected important stories, create Tasks/Subtasks.

Example:

```text
Story: Skill-Based Assignment

Tasks:
- Implement assignment scoring
- Implement skill validation
- Implement availability validation
- Implement conflict detection
- Implement preference scoring
- Implement fairness scoring
- Add assignment tests
```

Example:

```text
Story: Automate CI

Tasks:
- Configure CI workflow
- Run backend tests
- Run frontend lint
- Run frontend build
- Build Docker images
- Verify successful pipeline
```

Example:

```text
Story: Automate Deployment

Tasks:
- Configure deployment job
- Configure Docker Compose deployment
- Add health checks
- Verify container status
- Verify deployment failure handling
```

---

# 6. Bugs

Create realistic bugs related to the development history.

Examples:

### Bug 1 — Shift conflict incorrectly allowed

Description:

A volunteer could potentially be considered for overlapping shifts.

Priority: High

---

### Bug 2 — Backend health check failure

Description:

Deployment health verification fails when the backend is not ready within the expected startup period.

Priority: High

---

### Bug 3 — Frontend build failure

Description:

Frontend production build fails because of an invalid dependency or source issue.

Priority: Medium

---

Do not claim these bugs occurred in production unless there is actual evidence.

They should be represented as development/testing backlog items where appropriate.

---

# 7. Sprint Structure

Create realistic Scrum sprints based on the project's actual development.

Use approximately four sprints.

## Sprint 1 — Foundation

Goal:

Build the basic application foundation.

Include:

* Backend setup
* Frontend setup
* Database setup
* Git repository
* Basic Docker setup

Suggested duration:

2 weeks

---

## Sprint 2 — Volunteer & Assignment Management

Goal:

Build the core volunteer coordination functionality.

Include:

* Volunteer management
* Skills
* Availability
* Event zones
* Assignment engine
* Conflict detection
* Fairness

Suggested duration:

2 weeks

---

## Sprint 3 — Event Operations

Goal:

Enable coordinators to operate the event.

Include:

* Attendance
* Check-in/out
* Issue reporting
* Escalation
* Coordinator dashboard

Suggested duration:

2 weeks

---

## Sprint 4 — DevOps & Monitoring

Goal:

Automate deployment and monitor the platform.

Include:

* Docker
* Docker Compose
* CI
* CD
* Prometheus
* Grafana
* Testing
* Deployment verification

Suggested duration:

2 weeks

---

# 8. Story Points

Use Fibonacci-style estimation:

```text
1, 2, 3, 5, 8, 13
```

Use larger values only for genuinely complex stories.

Do not artificially assign 13 to everything.

The Assignment Engine and Coordinator Dashboard can reasonably have higher estimates.

---

# 9. Priorities

Use Jira priorities consistently:

```text
Highest
High
Medium
Low
```

Core assignment, attendance, issue escalation and deployment should generally have higher priority.

---

# 10. Scrum Board

Configure the Scrum board with:

```text
TO DO
IN PROGRESS
TESTING
DONE
```

The board should visibly demonstrate work moving through the Agile workflow.

Example:

```text
┌────────────┬──────────────┬───────────┬────────────┐
│ TO DO      │ IN PROGRESS  │ TESTING   │ DONE       │
├────────────┼──────────────┼───────────┼────────────┤
│ Story      │ Assignment   │ CI Story  │ Git Setup  │
│ Dashboard  │ Engine       │ Docker    │ DB Setup   │
│ Attendance │              │           │ Volunteers │
└────────────┴──────────────┴───────────┴────────────┘
```

Use actual Jira issues rather than simply documenting this diagram.

---

# 11. Kanban demonstration

The Jira board should also be usable as a Kanban-style workflow.

Demonstrate:

```text
Backlog
   ↓
To Do
   ↓
In Progress
   ↓
Testing
   ↓
Done
```

Move at least several real issues through these states so the board has visible development history.

Do not fake timestamps or completion dates.

---

# 12. Sprint planning

For each sprint:

* Add a Sprint Goal
* Select backlog items
* Assign story points
* Set priorities
* Move selected stories into the sprint
* Demonstrate sprint progress

The final Jira project should clearly show that work was planned incrementally rather than all issues being placed into one sprint.

---

# 13. Jira reports

Enable/use relevant Jira reports where available:

* Sprint Burndown
* Sprint Report
* Velocity Chart
* Cumulative Flow Diagram

These reports should use the actual Jira issues and sprint data.

Do not fabricate charts or screenshots.

---

# 14. Experiment documentation

Create:

```text
docs/experiment-6-jira.md
```

Document:

## Experiment 6 — Agile Project Management Using Jira

### Aim

Explain the purpose of Agile/Scrum/Jira.

### Project

Event Volunteer & Crowd Coordination Platform.

### Agile Methodology

Explain briefly why Scrum was used.

### Epics

List all EVCP Epics.

### User Stories

Show representative User Stories.

### Sprint Planning

Show the four sprint structure.

### Scrum Board

Explain the workflow:

```text
To Do → In Progress → Testing → Done
```

### Kanban

Explain how the same workflow provides Kanban-style visualization.

### Story Points

Explain Fibonacci estimation.

### Bugs

Document development/testing bugs.

### Reports

Document Sprint Report, Burndown, Velocity and/or Cumulative Flow where available.

### Result

State that Jira was used to manage the EVCP development using Agile/Scrum practices.

Only report features that were actually configured and demonstrated.

---

# 15. Important restrictions

Do NOT:

* Modify application architecture
* Add new backend features
* Add new frontend features
* Add new agents
* Change Docker configuration
* Change CI/CD
* Change Prometheus/Grafana
* Rewrite existing code
* Create fake Jira screenshots
* Claim Jira activities happened if they were not actually performed

This experiment should focus on **Jira and Agile project management**.

---

# 16. Final response

After preparing the documentation and project mapping, provide:

1. Jira project structure
2. Epics created
3. User Stories created
4. Tasks/Subtasks
5. Bugs
6. Sprint structure
7. Scrum board workflow
8. Kanban workflow
9. Story point strategy
10. Jira reports used
11. Documentation file created
12. Anything that still needs to be manually configured in Jira

Clearly separate:

```text
IMPLEMENTED
VERIFIED
MANUAL JIRA ACTION REQUIRED
```

Do not claim Jira configuration is complete if the actual Jira web project still needs manual setup.
