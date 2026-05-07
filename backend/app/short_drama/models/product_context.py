from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.sql import func

from ...database import Base


class ProductContextRecord(Base):
    __tablename__ = "short_drama_product_contexts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("short_drama_projects.id"), nullable=False, index=True)
    raw_inputs_json = Column(JSON, nullable=False)
    image_understanding_json = Column(JSON, nullable=True)
    normalized_context_json = Column(JSON, nullable=False)
    parse_status = Column(String, nullable=False, default="success")
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
