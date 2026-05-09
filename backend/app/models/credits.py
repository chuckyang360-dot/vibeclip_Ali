from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from ..database import Base


class UserCreditAccount(Base):
    __tablename__ = "user_credit_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    current_balance = Column(Integer, nullable=False, default=0)
    total_granted = Column(Integer, nullable=False, default=0)
    total_consumed = Column(Integer, nullable=False, default=0)
    total_refunded = Column(Integer, nullable=False, default=0)
    frozen_balance = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserCreditTransaction(Base):
    __tablename__ = "user_credit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    transaction_type = Column(String, nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    balance_before = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    related_object_type = Column(String, nullable=True)
    related_object_id = Column(String, nullable=True)
    project_id = Column(Integer, ForeignKey("short_drama_projects.id"), nullable=True, index=True)
    asset_id = Column(Integer, ForeignKey("short_drama_assets.id"), nullable=True, index=True)
    video_id = Column(Integer, nullable=True, index=True)
    api_call_log_id = Column(Integer, ForeignKey("api_call_logs.id"), nullable=True, index=True)
    operator_type = Column(String, nullable=False, default="system")
    operator_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
