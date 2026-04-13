FROM python:3.11-slim AS builder
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ git curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: runtime ───────────────────────────────────
FROM python:3.11-slim AS runtime
WORKDIR /app

COPY --from=builder /install /usr/local

RUN addgroup --system quantiq && adduser --system --ingroup quantiq quantiq

# FIX: Copy the entire project context to ensure main.py and all modules are included
COPY . .

RUN chown -R quantiq:quantiq /app
USER quantiq

EXPOSE 8000

# Health check (Note: if your app has a specific /health endpoint, use that URL)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

# If main.py is in the root, keep this as is:
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]