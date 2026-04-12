
FROM python:3.11-slim AS builder

WORKDIR /build

# System deps needed to compile some packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ git curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps into a prefix dir (not system)
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt && \
    pip install --no-cache-dir --prefix=/install vaderSentiment

# ── Stage 2: runtime — lean final image ───────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy only compiled packages from builder
COPY --from=builder /install /usr/local

# Create non-root user — never run a financial app as root
RUN addgroup --system quantiq && adduser --system --ingroup quantiq quantiq

# Copy only the source code needed to run (not model weights, not .git, not tests)
# Make sure your .dockerignore excludes: .git, __pycache__, *.pyc, model/weights/,
# node_modules, frontend/, k8s/, *.md
COPY main.py      ./main.py
COPY auth.py      ./auth.py
COPY rag/         ./rag/
COPY model/       ./model/

# Own the workdir
RUN chown -R quantiq:quantiq /app

USER quantiq

EXPOSE 8000

# Health check — Kubernetes will also probe this
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

# Production: no --reload flag
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "2", "--log-level", "info"]
