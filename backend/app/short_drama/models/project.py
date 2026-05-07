from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from ...database import Base
from ..utils.enums import ProjectStatus


class ShortDramaProject(Base):
    __tablename__ = "short_drama_projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default=ProjectStatus.CREATED.value, index=True)
    duration = Column(String, nullable=True)
    format = Column(String, nullable=True)
    style = Column(String, nullable=True)
    visual_style = Column(String, nullable=True)
    aspect_ratio = Column(String, nullable=True)
    target_market = Column(String, nullable=True)
    marketing_goal = Column(String, nullable=True)
    target_audience = Column(String, nullable=True)
    brand_tone = Column(String, nullable=True)
    creative_intent = Column(String, nullable=True)
    creative_brief = Column(String, nullable=True)
    workflow_language = Column(String, nullable=True)
    video_language = Column(String, nullable=True)
    last_active_step = Column(String, nullable=True, index=True)
    step_status = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
