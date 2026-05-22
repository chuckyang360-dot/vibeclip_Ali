from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from ..database import Base


class AIModelCatalog(Base):
    __tablename__ = "ai_model_catalog"
    __table_args__ = (
        UniqueConstraint("provider", "model_id", "capability", name="uq_ai_model_provider_model_capability"),
    )

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, nullable=False, index=True)
    model_id = Column(String, nullable=False, index=True)
    display_name = Column(String, nullable=False)
    capability = Column(String, nullable=False, index=True)
    enabled = Column(Boolean, nullable=False, default=True, index=True)
    sort_order = Column(Integer, nullable=False, default=100)
    config_schema = Column(JSON, nullable=True)
    default_config = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AIPromptTemplate(Base):
    __tablename__ = "ai_prompt_templates"

    id = Column(Integer, primary_key=True, index=True)
    stage_key = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    status = Column(String, nullable=False, default="draft", index=True)
    system_prompt = Column(Text, nullable=False, default="")
    user_prompt_template = Column(Text, nullable=True)
    variables_schema = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AIStageConfig(Base):
    __tablename__ = "ai_stage_configs"
    __table_args__ = (UniqueConstraint("stage_key", name="uq_ai_stage_configs_stage_key"),)

    id = Column(Integer, primary_key=True, index=True)
    stage_key = Column(String, nullable=False, index=True)
    stage_name = Column(String, nullable=False)
    active_model_id = Column(Integer, ForeignKey("ai_model_catalog.id"), nullable=True, index=True)
    fallback_model_id = Column(Integer, ForeignKey("ai_model_catalog.id"), nullable=True, index=True)
    active_prompt_template_id = Column(Integer, ForeignKey("ai_prompt_templates.id"), nullable=True, index=True)
    config_json = Column(JSON, nullable=True)
    enabled = Column(Boolean, nullable=False, default=True, index=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
