Now implement **Phase 1, Step 1: Git Foundation** for the existing Event Volunteer & Crowd Coordination Platform.

This is for **Experiment 1: Version control operations using Git.**

IMPORTANT:

* Do NOT modify application functionality.
* Do NOT change the frontend UI.
* Do NOT change backend business logic.
* Do NOT rewrite existing models, APIs, assignment engine, or tests.
* Only add/improve Git repository configuration and documentation.
* Inspect the existing Git state before making changes.

### Tasks

1. Inspect the existing Git repository:

   * Current branch
   * Existing branches
   * Existing commits
   * Existing remote
   * Existing `.gitignore`
   * Any accidentally tracked files

2. Create/update a clean `.gitignore` suitable for this project.

It must ignore at minimum:

* Python virtual environments
* `__pycache__`
* `.pyc` files
* SQLite database files
* `.env` and secret files
* Node modules
* frontend build output
* IDE/editor files
* OS-generated files
* test/cache files

IMPORTANT:
Do not delete existing useful source files.

3. Add a Git workflow document:

Create:

`docs/GIT_WORKFLOW.md`

Document a simple feature-branch workflow:

main
→ feature/<feature-name>
→ Pull Request
→ merge into main

Explain:

* Creating a branch
* Making commits
* Conventional Commit format
* Pull requests
* Merging
* Keeping branches updated

4. Use Conventional Commits.

Document examples such as:

feat: add volunteer attendance metrics
fix: resolve shift assignment conflict
test: add assignment engine tests
docs: update deployment guide
ci: add GitHub Actions pipeline
docker: add backend containerization

5. Add a pull request template:

`.github/pull_request_template.md`

It should contain:

* Description
* Related Jira issue
* Changes made
* Testing performed
* Checklist

6. Add a basic issue template if appropriate.

7. Do NOT create fake commits, fake branches, or fake Jira IDs.

8. Do NOT push anything to GitHub automatically.

9. After making the changes, verify:

* `.gitignore` works
* No secrets/database/build artifacts are tracked
* Existing application files remain intact
* Git status is clean except for the newly created/modified Git documentation files

10. Give me a concise report:

* Files created/modified
* Git configuration added
* Existing Git setup discovered
* Verification results

Do not proceed to Docker, Prometheus, CI/CD, Jira, or any other phase yet.
