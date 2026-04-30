"""Compatibility entrypoint for deployments launched from the repo root.

The production Python service lives in backend/main.py. Keeping this thin
loader prevents root-level Procfile/Docker launches from serving the older
legacy API shapes.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent / "backend"
BACKEND_MAIN = BACKEND_DIR / "main.py"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

spec = importlib.util.spec_from_file_location("fintrest_backend_main", BACKEND_MAIN)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to load backend app from {BACKEND_MAIN}")

module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

app = module.app
