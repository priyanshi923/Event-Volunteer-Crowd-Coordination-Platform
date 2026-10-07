# ==============================================================================
# Stage 1: Build the React / Vite Application
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install project dependencies
RUN npm ci

# Copy application source code
COPY . .

# Build argument for dynamic backend API URL if specified at build time
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build optimized production bundle
RUN npm run build

# ==============================================================================
# Stage 2: Serve via Lightweight Production Nginx
# ==============================================================================
FROM nginx:1.27-alpine AS runner

# Remove default nginx html files
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration supporting SPA routing and API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/nginx-health || exit 1

EXPOSE 80

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
