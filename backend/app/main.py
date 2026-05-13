from pathlib import Path
import logging
import os
import shutil

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import init_db
from .admin.router import router as admin_router
from .auth.routes import router as auth_router
from .routes.billing import router as billing_router
from .short_drama.routes import router as short_drama_router

# Import models so Base.metadata includes short drama tables before init_db()
from .models import (  # noqa: F401
    AdminOperationLog,
    ApiCallLog,
    PaymentOrder,
    User,
    UserCreditAccount,
    UserCreditTransaction,
)
from .short_drama.models import (  # noqa: F401
    AssetEntity,
    AssetImage,
    AssetReferenceImage,
    CharacterAsset,
    ProductAsset,
    ProductContextRecord,
    RenderJob,
    SceneAsset,
    SegmentScriptRecord,
    ShortDramaProject,
    StoryBlueprintRecord,
)

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

ffmpeg_path = shutil.which("ffmpeg")
if ffmpeg_path is not None:
    logging.info("[FFMPEG_RUNTIME_READY] ffmpeg_cmd=%s", ffmpeg_path)
else:
    logging.error("[FFMPEG_NOT_FOUND_IN_ENV] ffmpeg not found in PATH")

app = FastAPI(
    title="Vibe Clip API",
    description="Backend API for Vibe Clip (short drama)",
    version="1.0.0",
    debug=settings.DEBUG,
)


_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "https://vibeclip-eight.vercel.app",
]


def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")


def _split_origins(raw: str) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",")]


def _cors_allow_origins() -> list[str]:
    raw_cors = settings.CORS_ORIGINS or ""
    frontend_origin = settings.FRONTEND_ORIGIN or ""
    frontend_url = settings.FRONTEND_URL or ""

    merged = [
        *_DEFAULT_CORS_ORIGINS,
        *_split_origins(raw_cors),
        frontend_origin,
        frontend_url,
    ]

    unique_origins: list[str] = []
    seen: set[str] = set()
    for origin in merged:
        normalized = _normalize_origin(origin)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique_origins.append(normalized)
    return unique_origins


_allowed_origins = _cors_allow_origins()
logging.info("[CORS] allowed_origins=%s", _allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Authorization"],
)

init_db()

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(billing_router, prefix="/api/billing", tags=["Billing"])
app.include_router(short_drama_router, prefix="/api/short-drama", tags=["Short Drama"])

_backend_root = Path(__file__).resolve().parent.parent
_repo_root = _backend_root.parent

_short_drama_gen = _backend_root / "generated" / "short_drama_assets"
_short_drama_gen.mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/short-drama-assets",
    StaticFiles(directory=str(_short_drama_gen)),
    name="short_drama_asset_files",
)

_short_drama_vid = _backend_root / "generated" / "short_drama_videos"
_short_drama_vid.mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/short-drama-videos",
    StaticFiles(directory=str(_short_drama_vid)),
    name="short_drama_video_files",
)

_short_drama_xai_ref = _backend_root / "generated" / "short_drama_xai_assets"
_short_drama_xai_ref.mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/short-drama-xai-assets",
    StaticFiles(directory=str(_short_drama_xai_ref)),
    name="short_drama_xai_ref_files",
)

_static_fallback = _backend_root / "static"
_static_fallback.mkdir(parents=True, exist_ok=True)
_frontend_build = _repo_root / "frontend" / "build"
_static_mount_dir = _frontend_build if _frontend_build.is_dir() else _static_fallback
app.mount("/static", StaticFiles(directory=str(_static_mount_dir)), name="static")


@app.get("/")
async def root():
    return {"message": "Vibe Clip API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "vibe-clip-backend"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
