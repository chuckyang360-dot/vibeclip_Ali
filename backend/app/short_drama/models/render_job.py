from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func

from ...database import Base


class RenderJob(Base):
    __tablename__ = "short_drama_render_jobs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("short_drama_projects.id"), nullable=False, index=True)
    target_type = Column(String, nullable=False, index=True)
    target_id = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=True)
    provider_request_id = Column(String, nullable=True, index=True)
    model = Column(String, nullable=True)
    status = Column(String, nullable=False, default="queued", index=True)
    input_payload_json = Column(JSON, nullable=True)
    output_url = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    meta_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
