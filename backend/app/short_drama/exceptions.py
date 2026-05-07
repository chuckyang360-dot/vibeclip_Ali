class ShortDramaProviderError(Exception):
    """xAI / network / HTTP failures (non-200, timeout, misconfiguration)."""


class ShortDramaInvalidModelOutputError(Exception):
    """Unparseable JSON after repair, schema validation failure, or slot/prompt validation failure."""

    def __init__(
        self,
        message: str,
        *,
        segment_id: str | None = None,
        shot_id: str | None = None,
        missing_fields: list[str] | None = None,
        code: str | None = None,
    ):
        super().__init__(message)
        self.segment_id = segment_id
        self.shot_id = shot_id
        self.missing_fields = list(missing_fields or [])
        self.code = code

    def http_detail(self) -> str | dict:
        if self.segment_id is not None or self.shot_id is not None or self.missing_fields or self.code:
            return {
                "error": "short_drama_invalid_model_output",
                "message": str(self),
                "segment_id": self.segment_id,
                "shot_id": self.shot_id,
                "missing_fields": self.missing_fields,
                "code": self.code,
            }
        return str(self)


class ShortDramaImageProviderError(Exception):
    """Image provider / HTTP / quota / download errors for Short Drama asset images.

    category hints: auth, quota, rate_limit, xai_response_invalid, download_failed,
    local_persist_failed (latter usually ShortDramaImageSaveError), unsupported, configuration, provider
    """

    def __init__(self, message: str, *, category: str | None = None):
        super().__init__(message)
        self.category = category or "provider"


class ShortDramaImageSaveError(Exception):
    """Local filesystem save failure for generated assets."""


class ShortDramaVideoProviderError(Exception):
    """xAI video API / network / quota / timeout failures."""


class ShortDramaVideoSaveError(Exception):
    """Local filesystem save failure for generated segment/final videos."""


class ShortDramaInvalidSegmentVideoError(Exception):
    """Segment MP4 on disk failed size/signature/demux validation (placeholder, truncated, or corrupt)."""


class ShortDramaVideoInputError(Exception):
    """Invalid segment video inputs (prompt, duration, missing reference images, etc.)."""


class ShortDramaMergeError(Exception):
    """Final merge preconditions or ffmpeg failures."""


class ShortDramaFFmpegError(Exception):
    """ffmpeg binary missing or non-zero exit."""
