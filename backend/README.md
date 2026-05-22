# Vibe Clip Backend

FastAPI backend for the Vibe Clip short-drama generation workspace.

## Features

- Email/password authentication with JWT tokens
- User profile, account status, and admin role management
- Short-drama project workflow:
  - Creative intent capture
  - Product text/link/image understanding
  - Story blueprint generation
  - Character, scene, and product asset planning
  - Asset image generation
  - Segment script and video generation
  - Final video merge and export
- Credits and subscription billing
- Alipay and WeChat Pay order callbacks
- Admin dashboards for users, projects, credits, API logs, and operation logs

## Tech Stack

- Framework: FastAPI
- Database: SQLite for local development, PostgreSQL for production
- ORM: SQLAlchemy
- Auth: JWT
- AI providers: xAI, Gemini, Railway proxy, Seedance, and local mock providers for development
- Media: local static files in development, R2-compatible storage hooks where configured

## Local Development

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://127.0.0.1:8000`.

## Environment

Use `backend/.env.example` as the source of truth. Common local settings:

```env
PORT=8000
DEBUG=True
DATABASE_URL=sqlite:///./vibeclip.db
FRONTEND_ORIGIN=http://localhost:5173
PUBLIC_BASE_URL=http://localhost:8000
```

For real AI generation, configure the provider-specific keys in `.env`. For offline development, use the mock provider flags documented in `.env.example`.

## API Groups

- `/api/auth/*`: login, register, current user
- `/api/short-drama/*`: project workflow, product parsing, story, assets, segment scripts, videos, exports
- `/api/billing/*`: subscription orders, payment callbacks, credit records
- `/api/admin/*`: admin dashboards and operations
- `/health`: service health check
- `/docs`: Swagger UI

## Tests

```bash
cd backend
PYTHONPATH=. pytest -q
```

## Deployment

Relevant deployment files:

- `backend/Dockerfile`
- `backend/start.sh`
- `backend/railway.toml`
- `backend/docker-compose.yml`
- `deploy/aliyun/`

Before production deployment, set a strong `SECRET_KEY`, use PostgreSQL, configure exact CORS origins, configure public media/API origins, and disable development mock providers unless explicitly intended.
