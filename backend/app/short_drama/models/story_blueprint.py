from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.sql import func

from ...database import Base


class StoryBlueprintRecord(Base):
    __tablename__ = "short_drama_story_blueprints"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("short_drama_projects.id"), nullable=False, index=True)
    blueprint_json = Column(JSON, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    approved = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
