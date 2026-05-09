from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from ..database import Base


class ApiCallLog(Base):
    __tablename__ = "api_call_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("short_drama_projects.id"), nullable=True, index=True)
    business_type = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False, index=True)
    model = Column(String, nullable=True)
    status = Column(String, nullable=False, index=True)
    http_status = Column(Integer, nullable=True)
    error_code = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    estimated_cost_usd = Column(Numeric(18, 6), nullable=True)
    estimated_cost_cny = Column(Numeric(18, 6), nullable=True)
    request_summary = Column(Text, nullable=True)
    response_summary = Column(Text, nullable=True)
    file_size = Column(Integer, nullable=True)
    object_key = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
