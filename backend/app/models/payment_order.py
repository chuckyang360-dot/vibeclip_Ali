from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from ..database import Base


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    out_trade_no = Column(String, unique=True, nullable=False, index=True)
    plan_code = Column(String, nullable=False)
    period = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, nullable=False, default="CNY")
    payment_provider = Column(String, nullable=False, default="alipay")
    status = Column(String, nullable=False, default="pending")  # pending/paid/failed/cancelled
    subject = Column(String, nullable=False)
    alipay_trade_no = Column(String, nullable=True, index=True)
    wechat_transaction_id = Column(String, nullable=True, index=True)
    raw_notify = Column(Text, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
