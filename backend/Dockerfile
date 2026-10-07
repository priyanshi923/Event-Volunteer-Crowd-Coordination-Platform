# ==============================================================================
# Production Dockerfile for Event Volunteer Platform Backend (FastAPI)
# ==============================================================================
FROM python:3.13-slim

WORKDIR /app

# Set environment variables for production optimization
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Install curl for healthcheck and gosu for dropping privileges in entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for caching efficiency
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-privileged system user and configure permissions
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser \
    && mkdir -p /app/data /app/uploads/events \
    && chown -R appuser:appgroup /app

# Copy backend application source files and entrypoint
COPY --chown=appuser:appgroup . .

# Ensure entrypoint script is executable
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

# Container healthcheck probe against the /health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]

# Execute Uvicorn server bound to 0.0.0.0 with dynamic PORT fallback
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
