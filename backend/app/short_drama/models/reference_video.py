from sqlalchemy import Column, DateTime, Integer, JSON, String
from sqlalchemy.sql import func

from ...database import Base


class ReferenceVideoAnalysis(Base):
    __tablename__ = "short_drama_reference_videos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    original_filename = Column(String, nullable=False, default="")
    mime_type = Column(String, nullable=False, default="")
    file_size = Column(Integer, nullable=False, default=0)
    duration_seconds = Column(Integer, nullable=True)
    storage_provider = Column(String, nullable=False, default="r2")
    storage_key = Column(String, nullable=False, default="")
    public_url = Column(String, nullable=False, default="")
    analysis_status = Column(String, nullable=False, default="uploaded")
    analysis_json = Column(JSON, nullable=True)
    generated_prompt = Column(String, nullable=False, default="")
    error_message = Column(String, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
