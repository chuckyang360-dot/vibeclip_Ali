import os

import boto3

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

    s3.upload_file(file_path, bucket, key)

    return f"{base_url.rstrip('/')}/{key.lstrip('/')}"
