from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.admin.deps import require_admin_user
from app.admin.ai_model_defaults import AI_STAGE_DEFINITIONS, DEFAULT_SCRIPT_IMPORT_SYSTEM_PROMPT
from app.admin.router import router as admin_router
from app.admin.ai_model_config_service import get_active_ai_stage_config, seed_default_ai_model_configs
from app.database import Base, get_db
from app.models import AIModelCatalog, AIPromptTemplate, AIStageConfig, User


def test_seed_default_ai_model_configs_idempotent() -> None:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        seed_default_ai_model_configs(db)
        seed_default_ai_model_configs(db)

        assert db.query(AIStageConfig).count() == len(AI_STAGE_DEFINITIONS)
        assert db.query(AIPromptTemplate).filter(AIPromptTemplate.status == "active").count() == len(AI_STAGE_DEFINITIONS)
        assert (
            db.query(AIModelCatalog)
            .filter(AIModelCatalog.provider == "gemini", AIModelCatalog.model_id == "veo-3.1-generate-preview")
            .count()
            == 1
        )

        s4 = get_active_ai_stage_config(db, "s4_video_generation")
        assert s4 is not None
        assert s4.provider == "xai"
        assert s4.model_id == "grok-imagine-video"
        assert s4.prompt_template_id is not None
    finally:
        db.close()


def test_seed_refreshes_seeded_script_import_prompt() -> None:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        seed_default_ai_model_configs(db)
        prompt = (
            db.query(AIPromptTemplate)
            .filter(AIPromptTemplate.stage_key == "script_import_parse", AIPromptTemplate.status == "active")
            .first()
        )
        assert prompt is not None
        prompt.system_prompt = "Parse an imported script, storyboard, or prompt template into strict JSON segments for direct S4 video generation."
        prompt.metadata_json = {"seeded": True}
        db.add(prompt)
        db.commit()

        seed_default_ai_model_configs(db)
        db.refresh(prompt)

        assert prompt.system_prompt == DEFAULT_SCRIPT_IMPORT_SYSTEM_PROMPT
        assert "Required JSON shape" in prompt.system_prompt
        assert prompt.user_prompt_template == "{script_import_payload}"
    finally:
        db.close()


def test_admin_ai_model_config_endpoints() -> None:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    admin = User(id=1, username="admin", name="Admin", email="admin@test.com", role="admin")
    admin.set_password("secret")
    db.add(admin)
    db.commit()
    seed_default_ai_model_configs(db)

    app = FastAPI()
    app.include_router(admin_router, prefix="/api/admin")

    def override_db():
        try:
            yield db
        finally:
            pass

    async def override_admin():
        return admin

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_admin_user] = override_admin

    client = TestClient(app)
    res = client.get("/api/admin/ai-models/configs")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == len(AI_STAGE_DEFINITIONS)

    s2 = next(item for item in data["items"] if item["stage_key"] == "s2_story_generation")
    gemini_text = next(m for m in s2["candidate_models"] if m["provider"] == "gemini")
    res = client.put(
        "/api/admin/ai-models/configs/s2_story_generation/model",
        json={"model_catalog_id": gemini_text["id"], "reason": "switch S2 to Gemini"},
    )
    assert res.status_code == 200
    assert res.json()["config"]["active_model"]["provider"] == "gemini"

    res = client.post(
        "/api/admin/ai-models/configs/s2_story_generation/prompts/publish",
        json={
            "name": "S2 test prompt",
            "system_prompt": "Return strict JSON for S2.",
            "user_prompt_template": "{story_payload}",
            "variables_schema": {"required": ["story_payload"]},
            "reason": "publish S2 prompt",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["config"]["active_prompt"]["name"] == "S2 test prompt"
    assert body["config"]["active_prompt"]["status"] == "active"
    db.close()
