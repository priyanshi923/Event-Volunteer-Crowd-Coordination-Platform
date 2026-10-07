#!/bin/sh
set -e

# Ensure required runtime directories exist
mkdir -p /app/data /app/uploads/events

# Ensure appuser owns the mounted volume directories for SQLite read/write operations
chown -R appuser:appgroup /app/data /app/uploads

# Drop privileges to appuser and execute the container command
if [ "$(id -u)" = "0" ]; then
    exec gosu appuser "$@"
else
    exec "$@"
fi
