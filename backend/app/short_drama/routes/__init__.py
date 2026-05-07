from fastapi import APIRouter

from .asset import router as asset_router
from .asset_images import router as asset_images_router
from .export import router as export_router
from .product import router as product_router
from .project import router as project_router
from .segment import router as segment_router
from .story import router as story_router
from .video import router as video_router

router = APIRouter()
router.include_router(project_router, prefix="/project", tags=["Short Drama — Project"])
router.include_router(export_router, prefix="/project", tags=["Short Drama — Export"])
router.include_router(product_router, prefix="/product", tags=["Short Drama — Product"])
router.include_router(story_router, prefix="/story", tags=["Short Drama — Story"])
router.include_router(asset_router, prefix="/assets/specs", tags=["Short Drama — Assets"])
router.include_router(asset_images_router, prefix="/assets/images", tags=["Short Drama — Asset Images"])
router.include_router(segment_router, prefix="/segment", tags=["Short Drama — Segments"])
router.include_router(video_router, prefix="/videos", tags=["Short Drama — Video"])

__all__ = ["router"]
