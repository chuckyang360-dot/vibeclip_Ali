# Vibe Clip Frontend Integration

This document describes how the React frontend talks to the FastAPI backend.

## Local URLs

- Backend: `http://127.0.0.1:8000`
- Frontend dev server: `http://127.0.0.1:5173`

The frontend Vite config proxies `/api` and `/static` to the backend during local development.

## Environment

Frontend:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Backend:

```env
FRONTEND_ORIGIN=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PUBLIC_BASE_URL=http://localhost:8000
```

## Auth Flow

1. The user registers or logs in through `/api/auth/register` or `/api/auth/login`.
2. The backend returns a JWT access token and a public user payload.
3. The frontend stores the token and user profile through `frontend/src/services/api.ts`.
4. Protected API calls should send `Authorization: Bearer <token>`.
5. `/api/auth/me` refreshes the current user profile.

## Short-Drama Workflow APIs

The current frontend client lives in `frontend/src/services/shortDramaApi.ts`.

Important endpoint groups:

- `POST /api/short-drama/project`: create a project
- `GET /api/short-drama/project`: list projects
- `GET /api/short-drama/project/{project_id}`: load project metadata
- `PATCH /api/short-drama/project/{project_id}/creative-intent`: save creative intent
- `PATCH /api/short-drama/project/{project_id}/product-input`: save product input
- `POST /api/short-drama/product/parse`: parse product data
- `POST /api/short-drama/story/generate`: generate story blueprint
- `POST /api/short-drama/assets/specs/generate`: generate asset specs
- `POST /api/short-drama/assets/images/generate`: generate asset images
- `POST /api/short-drama/segment/generate`: generate segment scripts
- `POST /api/short-drama/videos/generate`: generate segment videos
- `POST /api/short-drama/videos/merge`: merge the final video
- `GET /api/short-drama/project/{project_id}/pipeline`: load workflow summary

## Billing APIs

- `POST /api/billing/alipay/create-order`
- `POST /api/billing/wechat/create-order`
- `GET /api/billing/orders/{order_ref}`
- `GET /api/billing/me`

Payment provider callback endpoints are called by the payment platforms and do not require the frontend token.

## Production Notes

- Set `VITE_API_BASE_URL` to the public API origin, for example `https://api.example.com`.
- Set backend CORS origins to the exact frontend domains.
- Ensure public static/media URL settings match the deployed backend or object storage origin.
- Keep mock providers disabled for real production generation unless a staged environment intentionally uses them.
