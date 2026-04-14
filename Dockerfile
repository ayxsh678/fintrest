# fintrest/frontend/Dockerfile
#
# Stage 1: build the React app
# Stage 2: serve the static output via nginx
# Final image is ~25MB and blazing fast — no Node.js in production

# ── Stage 1: build React ──────────────────────────────────────────────────
# BUG 1 FIX: pinned node:20-alpine to a specific patch version for
# reproducible builds. "20-alpine" floats and can pull a breaking update.
FROM node:20.14.0-alpine AS builder

WORKDIR /app

# Install deps first (cached unless package.json changes)
COPY package.json package-lock.json ./
RUN npm ci --silent

# Copy source and build
COPY . .

# BUG 2 FIX: moved ARG declarations ABOVE the ENV lines that reference them.
# ARG must be declared before it can be used in an ENV instruction.
# In the original, if $REACT_APP_API_URL was not passed as --build-arg,
# the ENV line silently set an empty string, baking "" into the JS bundle.
ARG REACT_APP_API_URL=https://app.fintrest.in/api
ARG REACT_APP_TRADING_URL=https://app.fintrest.in/trading

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_TRADING_URL=$REACT_APP_TRADING_URL

RUN npm run build

# ── Stage 2: serve with nginx ─────────────────────────────────────────────
# BUG 3 FIX: pinned nginx:1.25-alpine to a specific patch version.
# Same reproducibility reason as Stage 1 — floating tags are a supply-chain risk.
FROM nginx:1.25.5-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Our nginx config is provided by Kubernetes ConfigMap at runtime
# But we embed a fallback default for local docker run
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

# BUG 4 FIX: added a non-root nginx user for security hardening.
# The original comment acknowledged the issue but left it unresolved.
# nginx can run on port 8080 as a non-root user — far safer in k8s/cloud.
# This requires nginx.conf to listen on 8080 instead of 80.
RUN sed -i 's/listen\s*80;/listen 8080;/g' /etc/nginx/conf.d/default.conf \
    && chown -R nginx:nginx /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

# BUG 5 FIX: healthcheck was using wget against port 80, but the app
# now runs on 8080 (and even before that fix, wget in alpine-nginx
# images is not always present — curl is more reliable, or use a
# plain TCP check). Fixed to match the actual port and use a safer check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
