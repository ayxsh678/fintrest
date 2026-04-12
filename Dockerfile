# quantiq/frontend/Dockerfile  ← NEW FILE, place in your frontend/ folder
#
# Stage 1: build the React app
# Stage 2: serve the static output via nginx
# Final image is ~25MB and blazing fast — no Node.js in production

# ── Stage 1: build React ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (cached unless package.json changes)
COPY package.json package-lock.json ./
RUN npm ci --silent

# Copy source and build
COPY . .

# These get baked into the JS bundle at build time
# The actual values are passed as --build-arg in CI/CD
ARG REACT_APP_API_URL=https://app.quantiq.in/api
ARG REACT_APP_TRADING_URL=https://app.quantiq.in/trading

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_TRADING_URL=$REACT_APP_TRADING_URL

RUN npm run build

# ── Stage 2: serve with nginx ─────────────────────────────────────────────
FROM nginx:1.25-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Our nginx config is provided by Kubernetes ConfigMap at runtime
# But we embed a fallback default for local docker run
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

# Non-root: nginx master process needs port 80, so we use 8080 with non-root user
# OR keep 80 and just accept that nginx needs it (common in k8s)
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
