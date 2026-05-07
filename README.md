# Vibe Clip

独立部署的短剧工作台：**`backend/`**（FastAPI + SQLAlchemy）与 **`frontend/`**（Vite + React）。

## 本地开发

- 后端：`cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000`
- 前端：`cd frontend && npm install && npm run dev`（默认 `http://127.0.0.1:5173`）

## 环境变量

- 仓库根目录：`.env.example`
- 后端：`backend/.env.example`
- 前端：`frontend/.env.example`

## 部署

- 后端：见 `backend/Dockerfile`、`backend/railway.toml`、`backend/start.sh`
- 前端：见 `frontend/vercel.json`，构建在 `frontend/` 目录执行 `npm run build`
