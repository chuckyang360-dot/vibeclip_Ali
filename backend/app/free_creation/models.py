from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func

from ..database import Base


class FreeCreationProject(Base):
    __tablename__ = "free_creation_projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_name = Column(String, nullable=False, default="自由创作项目")
    status = Column(String, nullable=False, default="created", index=True)
    final_video_url = Column(Text, nullable=False, default="")
    final_video_storage_key = Column(String, nullable=False, default="")
    final_render_status = Column(String, nullable=False, default="idle", index=True)
    final_render_error = Column(Text, nullable=False, default="")
    settings_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FreeCreationAsset(Base):
    __tablename__ = "free_creation_assets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("free_creation_projects.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    asset_type = Column(String, nullable=False, index=True)
    url = Column(Text, nullable=False, default="")
    storage_key = Column(String, nullable=False, default="")
    file_name = Column(String, nullable=False, default="")
    mime_type = Column(String, nullable=False, default="")
    file_size = Column(Integer, nullable=False, default=0)
    label = Column(String, nullable=False, default="")
    role = Column(String, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FreeCreationSegment(Base):
    __tablename__ = "free_creation_segments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("free_creation_projects.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    segment_index = Column(Integer, nullable=False, default=1, index=True)
    title = Column(String, nullable=False, default="")
    prompt = Column(Text, nullable=False, default="")
    model = Column(String, nullable=False, default="doubao-seedance-2-0-260128")
    ratio = Column(String, nullable=False, default="9:16")
    resolution = Column(String, nullable=False, default="720p")
    duration = Column(Integer, nullable=False, default=5)
    generate_audio = Column(Boolean, nullable=False, default=True)
    watermark = Column(Boolean, nullable=False, default=False)
    input_assets_json = Column(JSON, nullable=True)
    status = Column(String, nullable=False, default="idle", index=True)
    error_message = Column(Text, nullable=False, default="")
    provider_task_id = Column(String, nullable=False, default="", index=True)
    provider_video_url = Column(Text, nullable=False, default="")
    video_url = Column(Text, nullable=False, default="")
    video_storage_key = Column(String, nullable=False, default="")
    last_frame_url = Column(Text, nullable=False, default="")
    last_frame_storage_key = Column(String, nullable=False, default="")
    request_json = Column(JSON, nullable=True)
    response_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FreeCreationRenderJob(Base):
    __tablename__ = "free_creation_render_jobs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("free_creation_projects.id"), nullable=False, index=True)
    segment_id = Column(Integer, ForeignKey("free_creation_segments.id"), nullable=True, index=True)
    target_type = Column(String, nullable=False, default="segment", index=True)
    status = Column(String, nullable=False, default="queued", index=True)
    progress = Column(Integer, nullable=False, default=0)
    provider_task_id = Column(String, nullable=False, default="", index=True)
    output_url = Column(Text, nullable=False, default="")
    error_message = Column(Text, nullable=False, default="")
    request_json = Column(JSON, nullable=True)
    response_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
