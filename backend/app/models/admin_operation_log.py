from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from ..database import Base


class AdminOperationLog(Base):
    __tablename__ = "admin_operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operator_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    operator_email = Column(String, nullable=False)
    action = Column(String, nullable=False, index=True)
    target_type = Column(String, nullable=False, index=True)
    target_id = Column(String, nullable=False, index=True)
    before_data = Column(Text, nullable=True)
    after_data = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
