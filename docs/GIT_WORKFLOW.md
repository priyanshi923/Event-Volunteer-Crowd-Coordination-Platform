# Git Version Control Workflow

**Project:** Event Volunteer & Crowd Coordination Platform  
**Workflow Model:** Feature-Branch Workflow (GitHub Flow)

---

## 1. Overview & Branching Model

The project follows a standardized, lightweight **Feature-Branch Workflow**. All code changes are developed in dedicated feature branches and integrated into the primary branch via peer-reviewed Pull Requests (PRs).

```
   main        ───────────────────────────────────────────────● (Production Release)
                \                                            /
   feature/*     └───●──────────────●──────────────●────────┘ (PR + Merge)
                     Branch         Commits        Tests Pass
```

### Branch Responsibilities
- **`main`**: The single source of truth. Always kept stable, deployable, and fully tested. Direct pushes to `main` are restricted in production environments.
- **`feature/<feature-name>`**: Ephemeral branches for developing new capabilities (e.g., `feature/volunteer-attendance`, `feature/incident-sla`).
- **`fix/<bug-name>`**: Branches dedicated to resolving identified defects (e.g., `fix/shift-assignment-conflict`).
- **`chore/<task-name>`** or **`docs/<task-name>`**: Non-functional updates like dependency updates or documentation.

---

## 2. Step-by-Step Developer Workflow

### Step 1: Update Local Main Branch
Before branching, ensure your local `main` branch is in sync with the remote repository:

```bash
git checkout main
git pull origin main
```

### Step 2: Create a Dedicated Feature Branch
Branch names should follow the kebab-case convention prefixed by the change type:

```bash
# Format: feature/<short-descriptive-name>
git checkout -b feature/attendance-metrics

# Or for a bug fix:
git checkout -b fix/no-show-grace-period
```

### Step 3: Make Incremental, Atomic Commits
Group related changes logically. Keep commits focused and avoid mixing unrelated refactors with functional changes.

```bash
# Stage specific files
git add backend/main.py backend/crud.py

# Commit with a Conventional Commit message
git commit -m "feat: add volunteer attendance metrics"
```

### Step 4: Keep Your Feature Branch Updated
If work on `main` has progressed while developing your feature branch, rebase or merge `main` to prevent merge conflicts early:

```bash
# Fetch latest remote changes
git fetch origin

# Option A: Rebase onto origin/main (recommended for clean linear history)
git rebase origin/main

# Option B: Merge main into your branch
git merge origin/main
```

### Step 5: Push Branch and Open a Pull Request
Push your branch to the remote repository:

```bash
git push -u origin feature/attendance-metrics
```

Open a Pull Request on GitHub targeting `main`. Complete the PR template with description, testing evidence, and verification notes.

### Step 6: Code Review & Merging
1. Automated CI checks (tests, linter) must pass.
2. Peer review approval is obtained.
3. Merge using **Squash and Merge** or **Rebase and Merge** to maintain a clean history on `main`.
4. Delete the feature branch on remote and local after merge:

```bash
git checkout main
git pull origin main
git branch -d feature/attendance-metrics
```

---

## 3. Conventional Commits Standard

All commit messages in this repository must adhere to the **Conventional Commits 1.0.0** specification.

### Commit Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Standard Commit Types

| Type | Purpose | Example |
|---|---|---|
| `feat` | New feature or capability | `feat: add volunteer attendance metrics` |
| `fix` | Bug fix in existing logic | `fix: resolve shift assignment conflict` |
| `test` | Adding or updating tests | `test: add assignment engine tests` |
| `docs` | Documentation-only changes | `docs: update deployment guide` |
| `ci` | CI/CD pipelines & scripts | `ci: add GitHub Actions pipeline` |
| `docker` | Containerization & Compose | `docker: add backend containerization` |
| `refactor` | Code restructuring without behavior change | `refactor: extract scoring heuristics in assignment engine` |
| `chore` | Dependency bumps, build configs, tool updates | `chore: update packages and lockfile` |

### Concrete Examples

```bash
# Feature addition
git commit -m "feat: add volunteer attendance metrics"

# Bug fix
git commit -m "fix: resolve shift assignment conflict"

# Test coverage
git commit -m "test: add assignment engine tests"

# Documentation
git commit -m "docs: update deployment guide"

# Continuous Integration
git commit -m "ci: add GitHub Actions pipeline"

# Containerization
git commit -m "docker: add backend containerization"
```

---

## 4. Pull Request Guidelines

1. **Title:** Use the Conventional Commit format for PR titles (e.g., `feat(attendance): add volunteer check-in duration tracking`).
2. **Atomic Scope:** Keep PRs under 400 lines of code change where possible to ensure thorough review.
3. **Automated Verification:** Ensure all existing automated tests pass locally before requesting review:
   ```bash
   cd backend
   python -m pytest
   ```
4. **No Tracked Artifacts:** Never include `.db`, `.env`, `node_modules/`, or build outputs (`dist/`) in a PR.
