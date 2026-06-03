from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from ..database import Base


class AdMaterialTask(Base):
    __tablename__ = "ad_material_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    template_id = Column(String, nullable=False, default="")
    mode = Column(String, nullable=False, default="template")
    title = Column(String, nullable=False, default="")
    status = Column(String, nullable=False, default="queued", index=True)
    error_message = Column(Text, nullable=False, default="")

    provider = Column(String, nullable=False, default="seedance")
    provider_task_id = Column(String, nullable=False, default="", index=True)
    provider_video_url = Column(Text, nullable=False, default="")

    video_url = Column(Text, nullable=False, default="")
    video_storage_key = Column(String, nullable=False, default="")
    last_frame_url = Column(Text, nullable=False, default="")
    last_frame_storage_key = Column(String, nullable=False, default="")

    prompt = Column(Text, nullable=False, default="")
    request_json = Column(JSON, nullable=True)
    response_json = Column(JSON, nullable=True)
    input_assets_json = Column(JSON, nullable=True)
    parameters_json = Column(JSON, nullable=True)

    model = Column(String, nullable=False, default="")
    ratio = Column(String, nullable=False, default="9:16")
    resolution = Column(String, nullable=False, default="720p")
    duration = Column(Integer, nullable=False, default=8)
    generate_audio = Column(Boolean, nullable=False, default=True)
    watermark = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
