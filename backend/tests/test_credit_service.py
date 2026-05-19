"""Credit balance and atomic deduct tests."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import User, UserCreditAccount, UserCreditTransaction
from app.services.credit_service import (
    CREDIT_COSTS,
    deduct_credits,
    ensure_credit_balance,
    grant_free_starter_credits_if_needed,
    InsufficientCreditsError,
)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    user = User(username="u1", name="U", email="u1@test.com")
    user.set_password("secret")
    session.add(user)
    session.commit()
    yield session
    session.close()


def test_free_grant_and_deduct_atomic(db) -> None:
    user_id = db.query(User).first().id
    grant_free_starter_credits_if_needed(db, user_id)
    db.commit()
    assert ensure_credit_balance(db, user_id, 30) == 100
    deduct_credits(
        db,
        user_id=user_id,
        amount=CREDIT_COSTS["script_generation"],
        transaction_type="script_generation_consume",
        note="脚本生成与解析",
        idempotency_key="test:script:1",
    )
    db.commit()
    assert db.query(UserCreditAccount).filter(UserCreditAccount.user_id == user_id).first().current_balance == 70


def test_insufficient_balance(db) -> None:
    user_id = db.query(User).first().id
    grant_free_starter_credits_if_needed(db, user_id)
    db.commit()
    with pytest.raises(InsufficientCreditsError):
        ensure_credit_balance(db, user_id, 10_000)


def test_idempotent_deduct(db) -> None:
    user_id = db.query(User).first().id
    grant_free_starter_credits_if_needed(db, user_id)
    db.commit()
    key = "test:idempotent"
    r1 = deduct_credits(
        db,
        user_id=user_id,
        amount=3,
        transaction_type="text_understanding_consume",
        note="文本/链接理解",
        idempotency_key=key,
    )
    r2 = deduct_credits(
        db,
        user_id=user_id,
        amount=3,
        transaction_type="text_understanding_consume",
        note="文本/链接理解",
        idempotency_key=key,
    )
    db.commit()
    assert r1.charged is True
    assert r2.charged is False
    assert db.query(UserCreditTransaction).filter(UserCreditTransaction.user_id == user_id).count() == 2
