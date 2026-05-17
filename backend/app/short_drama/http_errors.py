from fastapi import HTTPException, status

from .exceptions import (
    ShortDramaFFmpegError,
    ShortDramaImageProviderError,
    ShortDramaImageSaveError,
    ShortDramaInvalidModelOutputError,
    ShortDramaMergeError,
    ShortDramaProviderError,
    ShortDramaVideoInputError,
    ShortDramaVideoProviderError,
    ShortDramaVideoSaveError,
)
import logging

logger = logging.getLogger(__name__)


def classify_error_type(exc: Exception) -> str:
    msg = str(exc or "").lower()
    if isinstance(exc, ShortDramaInvalidModelOutputError):
        return "model_output_invalid"
    if isinstance(exc, ShortDramaImageSaveError):
        return "storage_or_db_error"
    if isinstance(exc, ShortDramaImageProviderError):
        cat = getattr(exc, "category", "") or ""
        if cat in ("rate_limit", "quota") or "429" in msg or "quota" in msg or "spending limit" in msg:
            return "provider_quota"
        if "timeout" in msg or "timed out" in msg:
            return "provider_timeout"
        return "image_generation_failed"
    if isinstance(exc, (ShortDramaProviderError, ShortDramaVideoProviderError)):
        if "429" in msg or "quota" in msg or "spending limit" in msg:
            return "provider_quota"
        if "timeout" in msg or "timed out" in msg:
            return "provider_timeout"
        return "provider_error"
    if isinstance(exc, (ShortDramaVideoSaveError, ShortDramaFFmpegError, ShortDramaMergeError)):
        return "storage_or_db_error"
    if isinstance(exc, ShortDramaVideoInputError):
        return "video_input_invalid"
    return "unknown_error"


def raise_short_drama_http(exc: Exception) -> None:
    """Map domain errors to HTTP responses (re-raises FastAPI HTTPException)."""
    raise _to_http_exception(exc)


def _to_http_exception(exc: Exception) -> HTTPException:
    err_type = classify_error_type(exc)
    logger.warning("[PROVIDER_ERROR_CLASSIFIED] error_type=%s exc=%s", err_type, type(exc).__name__)
    if isinstance(exc, ShortDramaInvalidModelOutputError):
        detail = exc.http_detail()
        user_message = "当前步骤的 AI 输出不完整或格式异常，请检查输入后重试；详细原因已记录在后端日志。"
        if getattr(exc, "code", None) == "s2_provider_duration_exceeded":
            user_message = "AI 生成的视频片段时长超过当前视频模型限制，请重新生成。"
        if isinstance(detail, dict):
            return HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={**detail, "user_message": user_message},
            )
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": str(detail), "user_message": user_message, "error": "short_drama_invalid_model_output"},
        )
    if isinstance(exc, (ShortDramaImageProviderError, ShortDramaImageSaveError)):
        msg = str(exc)
        if isinstance(exc, ShortDramaImageSaveError):
            return HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
            )
        cat = getattr(exc, "category", None) or "provider"
        if cat == "auth" or "GEMINI_API_KEY" in msg or "XAI_API_KEY" in msg or "not configured" in msg.lower():
            return HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED if cat == "auth" else status.HTTP_400_BAD_REQUEST,
                detail=msg,
            )
        if cat in ("rate_limit", "quota"):
            return HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
            )
        if cat in ("download_failed", "xai_response_invalid"):
            return HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
            )
        if cat == "unsupported":
            return HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
            )
        if cat == "configuration":
            return HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
            )
        if "timeout" in msg.lower():
            return HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
            )
        if "429" in msg or "quota" in msg.lower() or "resource" in msg.lower():
            return HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
            )
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
        )
    if isinstance(exc, ShortDramaProviderError):
        msg = str(exc)
        low = msg.lower()
        if (
            "short_drama_provider_timeout" in low
            or "timeout" in low
            or "timed out" in low
        ):
            return HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail={
                    "error": "short_drama_provider_timeout",
                    "user_message": "当前服务繁忙，请稍后重试。",
                    "error_type": "provider_timeout",
                },
            )
        if (
            "http 503" in low
            or "did not respond" in low
            or "service temporarily unavailable" in low
            or "upstream_unavailable" in low
        ):
            return HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "error": "short_drama_provider_unavailable",
                    "user_message": "当前服务繁忙，请稍后重试。",
                    "error_type": "provider_error",
                },
            )
        if "XAI_API_KEY" in msg or "not configured" in msg.lower():
            return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=msg)
    if isinstance(exc, ShortDramaVideoInputError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if isinstance(exc, (ShortDramaVideoProviderError, ShortDramaVideoSaveError)):
        msg = str(exc)
        if "XAI_API_KEY" in msg or "not configured" in msg.lower():
            return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        if "timeout" in msg.lower() or "timed out" in msg.lower() or "poll" in msg.lower():
            return HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail={"message": "AI provider timeout. Please retry.", "error_type": "provider_timeout"},
            )
        if "429" in msg or "quota" in msg.lower():
            return HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"message": "AI provider quota exceeded. Please try again later.", "error_type": "provider_quota"},
            )
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=msg)
    if isinstance(exc, (ShortDramaMergeError, ShortDramaFFmpegError)):
        msg = str(exc)
        if "ffmpeg" in msg.lower() and ("not found" in msg.lower() or "no such file" in msg.lower()):
            return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)
        if "missing" in msg.lower() or "incomplete" in msg.lower():
            return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=str(exc),
    )
