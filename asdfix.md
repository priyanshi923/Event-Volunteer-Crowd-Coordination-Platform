You are working on my existing **Event Volunteer & Crowd Coordination Platform** project.

## Current issue

Docker Compose is configured correctly, but the backend container keeps restarting.

The backend log shows:

```text
sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) unable to open database file
```

Current configuration:

```text
DATABASE_URL=sqlite:////app/data/event_platform.db
```

Docker Compose mounts:

```text
evcp_db_data -> /app/data
```

The backend Dockerfile currently runs the application as:

```dockerfile
USER appuser
```

We verified the mounted Docker volume permissions with:

```text
drwxr-xr-x 2 root root 4096 /app/data
```

Therefore `appuser` cannot write to `/app/data`.

## Your task

Fix this Docker SQLite permission problem **without changing the application's functionality or architecture**.

### Requirements

1. Inspect the existing:

   * `backend/Dockerfile`
   * `docker-compose.yml` / `compose.yml`
   * `backend/main.py`
   * `backend/database.py`

2. Do NOT redesign the project.

3. Do NOT change the database from SQLite.

4. Do NOT delete the existing Docker volume `evcp_db_data`.

5. Do NOT delete or recreate the existing database.

6. Do NOT change API endpoints or application logic unless absolutely required for this Docker fix.

7. Preserve the existing non-root `appuser` security approach.

### Preferred solution

Implement a small Docker entrypoint mechanism that:

1. Starts the container with enough privilege to fix the mounted volume permissions.
2. Changes ownership of:

   ```text
   /app/data
   /app/uploads
   ```

   to:

   ```text
   appuser:appgroup
   ```
3. Then drops privileges and starts:

   ```text
   uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
   ```

   as `appuser`.

Create an appropriate `backend/entrypoint.sh` if needed.

Update `backend/Dockerfile` accordingly.

Make sure the entrypoint is executable inside the image.

### Important

Do NOT use:

```text
docker compose down -v
```

because that would delete the existing named database volume.

Do NOT remove:

```text
evcp_db_data
```

## Verification

After making the changes:

1. Rebuild the backend image.
2. Restart the Docker Compose stack.
3. Check:

   ```text
   docker compose ps
   ```
4. Check:

   ```text
   docker compose logs backend --tail=50
   ```
5. Verify the backend becomes healthy instead of restarting.
6. Verify the SQLite database can be opened/created successfully.
7. Verify the `/health` endpoint works.
8. Verify the frontend/backend Compose dependency still works.

If a command fails, diagnose the actual error and fix it rather than making unrelated changes.

## Final response

After completing the fix, give me a concise report containing:

* Files changed
* What was changed
* Why the SQLite error occurred
* Docker commands executed
* Final container status
* Whether the backend health check passed
* Whether the existing database volume was preserved

Do not add new features or refactor unrelated code.
