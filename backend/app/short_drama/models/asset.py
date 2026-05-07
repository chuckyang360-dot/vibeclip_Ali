from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func

from ...database import Base


class AssetEntity(Base):
    __tablename__ = "short_drama_assets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("short_drama_projects.id"), nullable=False, index=True)
    asset_type = Column(String, nullable=False, index=True)  # character | scene | product
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    tags_json = Column(JSON, nullable=True)
    base_prompt = Column(Text, nullable=True)
    source = Column(String, nullable=False, default="system_generated")
    cover_image_id = Column(Integer, nullable=True, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="active")
    extra_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AssetImage(Base):
    __tablename__ = "short_drama_asset_images_v2"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("short_drama_assets.id"), nullable=False, index=True)
    image_url = Column(String, nullable=False)
    image_type = Column(String, nullable=False, default="generated")  # generated | uploaded | derived
    variant_label = Column(String, nullable=True)
    variant_meta = Column(JSON, nullable=True)
    prompt_snapshot = Column(Text, nullable=True)
    provider = Column(String, nullable=True)
    provider_params = Column(JSON, nullable=True)
    is_cover = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AssetReferenceImage(Base):
    __tablename__ = "short_drama_asset_reference_images"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("short_drama_assets.id"), nullable=False, index=True)
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_primary = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CharacterAsset(Base):
    __tablename__ = "short_drama_character_assets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("short_drama_projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    role_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    visual_prompt = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    meta_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SceneAsset(Base):
    __tablename__ = "short_drama_scene_assets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("short_drama_projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    scene_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    visual_prompt = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    meta_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProductAsset(Base):
    __tablename__ = "short_drama_product_assets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("short_drama_projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    visual_prompt = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    meta_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
