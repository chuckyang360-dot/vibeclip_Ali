"""Auth registration username + public user subscription fields."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.auth.user_payload import public_user_dict
from app.auth.username import allocate_unique_username
from app.database import Base
from app.models import User


def test_allocate_unique_username_prefers_display_name() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        existing = User(username="taken", name="Taken", email="taken@test.com")
        existing.set_password("secret")
        db.add(existing)
        db.commit()
        assert allocate_unique_username(db, preferred="杨总", email="a@b.com") == "杨总"
        assert allocate_unique_username(db, preferred="taken", email="x@y.com") == "taken_1"
    finally:
        db.close()


def test_public_user_dict_includes_username_and_subscription() -> None:
    user = User(
        username="杨总",
        name="杨总",
        email="chuckyang360@gmail.com",
    )
    user.id = 3
    user.subscription_status = "active"
    user.subscription_plan = "basic"
    user.subscription_period = "monthly"
    user.is_active = True

    payload = public_user_dict(user)
    assert payload["username"] == "杨总"
    assert payload["name"] == "杨总"
    assert payload["subscription_plan"] == "basic"
    assert payload["subscription_status"] == "active"
