import os
import time

import boto3

from ..admin.api_logger import safe_log_api_call

s3 = boto3.client(
    "s3",
    endpoint_url=os.getenv("R2_ENDPOINT"),
    aws_access_key_id=os.getenv("R2_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("R2_SECRET_KEY"),
    region_name="auto",
)


def upload_file(file_path: str, key: str) -> str:
    bucket = os.getenv("R2_BUCKET_NAME")
    base_url = os.getenv("R2_PUBLIC_BASE_URL")
    if not bucket:
        raise RuntimeError("R2_BUCKET_NAME is not configured")
    if not base_url:
        raise RuntimeError("R2_PUBLIC_BASE_URL is not configured")

    started = time.perf_counter()
    file_size: int | None = None
    try:
        file_size = os.path.getsize(file_path)
    except Exception:
        file_size = None

    try:
        s3.upload_file(file_path, bucket, key)
        duration_ms = int((time.perf_counter() - started) * 1000)
        safe_log_api_call(
            business_type="r2_upload",
            provider="Cloudflare R2",
            status="success",
            duration_ms=duration_ms,
            request_summary={"bucket": bucket},
            file_size=file_size,
            object_key=key,
        )
    except Exception as e:
        duration_ms = int((time.perf_counter() - started) * 1000)
        safe_log_api_call(
            business_type="r2_upload",
            provider="Cloudflare R2",
            status="failed",
            duration_ms=duration_ms,
            error_message=str(e),
            request_summary={"bucket": bucket},
            file_size=file_size,
            object_key=key,
        )
        raise

    return f"{base_url.rstrip('/')}/{key.lstrip('/')}"


def build_presigned_get_url(key: str, *, expires_seconds: int | None = None) -> str:
    bucket = os.getenv("R2_BUCKET_NAME")
    if not bucket:
        raise RuntimeError("R2_BUCKET_NAME is not configured")
    ttl = expires_seconds
    if ttl is None:
        raw = os.getenv("R2_PRESIGNED_GET_EXPIRES_SECONDS", "3600")
        try:
            ttl = int(raw)
        except ValueError:
            ttl = 3600
    ttl = max(60, min(int(ttl), 24 * 60 * 60))
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key.lstrip("/")},
        ExpiresIn=ttl,
    )
