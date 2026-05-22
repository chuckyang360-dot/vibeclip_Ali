# Vibe Clip Backend Quickstart

## 1. Configure Environment

```bash
cd backend
cp .env.example .env
```

For local development, these defaults are usually enough:

```env
PORT=8000
DEBUG=True
DATABASE_URL=sqlite:///./vibeclip.db
FRONTEND_ORIGIN=http://localhost:5173
PUBLIC_BASE_URL=http://localhost:8000
SHORT_DRAMA_IMAGE_PROVIDER=mock
SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER=true
SHORT_DRAMA_USE_MOCK_VIDEO_PROVIDER=true
```

For real generation, fill the provider keys documented in `.env.example`.

## 2. Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 3. Start Backend

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

You can also use:

```bash
./start.sh
```

## 4. Verify

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"healthy","service":"vibe-clip-backend"}
```

Open API docs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## 5. Run Tests

```bash
PYTHONPATH=. pytest -q
```

## Common Issues

### Port 8000 Is Busy

Change `PORT` in `.env` or run uvicorn with another port:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### Reset Local SQLite Database

Stop the server, remove the local database, then restart:

```bash
rm vibeclip.db
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend Cannot Reach Backend

Confirm `frontend/vite.config.ts` proxies `/api` and `/static` to `http://localhost:8000`, or set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env`.
