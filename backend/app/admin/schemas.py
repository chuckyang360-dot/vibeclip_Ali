from __future__ import annotations

from pydantic import BaseModel, Field


class CreditGrantRequest(BaseModel):
    amount: int = Field(..., gt=0)
    reason: str = Field(..., min_length=1)


class CreditDeductRequest(BaseModel):
    amount: int = Field(..., gt=0)
    reason: str = Field(..., min_length=1)


class ReasonRequest(BaseModel):
    reason: str = Field(..., min_length=1)
