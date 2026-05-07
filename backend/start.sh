#!/bin/sh
# Vibe Clip 后端 — Railway / 本地启动（uvicorn）

export PYTHONUNBUFFERED="${PYTHONUNBUFFERED:-1}"

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
