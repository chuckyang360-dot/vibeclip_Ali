import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from .config import settings

logger = logging.getLogger(__name__)

# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    pool_pre_ping=True,
    pool_recycle=1800,
    echo=settings.DB_DEBUG,
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()


def ensure_short_drama_project_columns(target_engine=None) -> None:
    """Idempotent migration for newly added short_drama_projects language/market columns."""
    db_engine = target_engine or engine
    table_name = "short_drama_projects"
    required_columns = {
        "target_market": ("VARCHAR", "'North America'"),
        "marketing_goal": ("VARCHAR", "'brand_seeding'"),
        "target_audience": ("VARCHAR", "''"),
        "brand_tone": ("VARCHAR", "'natural'"),
        "creative_intent": ("VARCHAR", "''"),
        "creative_brief": ("VARCHAR", "''"),
        "workflow_language": ("VARCHAR", "'zh-CN'"),
        "video_language": ("VARCHAR", "'en-US'"),
    }
    added_columns: list[str] = []
    skipped_columns: list[str] = []
    try:
        insp = inspect(db_engine)
        dialect = db_engine.dialect.name
        if not insp.has_table(table_name):
            logger.info(
                "[SHORT_DRAMA_DB_MIGRATION] table=%s added_columns=%s skipped_columns=%s dialect=%s",
                table_name,
                added_columns,
                list(required_columns.keys()),
                dialect,
            )
            return
        cols = {c["name"] for c in insp.get_columns(table_name)}
        with db_engine.begin() as conn:
            for col_name, (col_type, default_value) in required_columns.items():
                if col_name in cols:
                    skipped_columns.append(col_name)
                    continue
                if dialect == "postgresql":
                    stmt = (
                        f"ALTER TABLE {table_name} "
                        f"ADD COLUMN IF NOT EXISTS {col_name} {col_type} DEFAULT {default_value}"
                    )
                else:
                    stmt = (
                        f"ALTER TABLE {table_name} "
                        f"ADD COLUMN {col_name} {col_type} DEFAULT {default_value}"
                    )
                conn.execute(text(stmt))
                added_columns.append(col_name)
        logger.info(
            "[SHORT_DRAMA_DB_MIGRATION] table=%s added_columns=%s skipped_columns=%s dialect=%s",
            table_name,
            added_columns,
            skipped_columns,
            dialect,
        )
    except Exception:
        logger.exception(
            "[SHORT_DRAMA_DB_MIGRATION] table=%s added_columns=%s skipped_columns=%s dialect=%s",
            table_name,
            added_columns,
            skipped_columns,
            (db_engine.dialect.name if db_engine is not None else "unknown"),
        )
        raise


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_ensure_render_job_columns() -> None:
    """SQLite: add Phase 4 columns if DB was created before they existed."""
    if "sqlite" not in settings.DATABASE_URL:
        return
    try:
        insp = inspect(engine)
        if not insp.has_table("short_drama_render_jobs"):
            return
        cols = {c["name"] for c in insp.get_columns("short_drama_render_jobs")}
        alters: list[str] = []
        if "provider_request_id" not in cols:
            alters.append("ALTER TABLE short_drama_render_jobs ADD COLUMN provider_request_id VARCHAR")
        if "model" not in cols:
            alters.append("ALTER TABLE short_drama_render_jobs ADD COLUMN model VARCHAR")
        if "meta_json" not in cols:
            alters.append("ALTER TABLE short_drama_render_jobs ADD COLUMN meta_json TEXT")
        if not alters:
            return
        with engine.begin() as conn:
            for stmt in alters:
                conn.execute(text(stmt))
        logger.info("SQLite migration: short_drama_render_jobs columns added: %s", alters)
    except Exception:
        logger.exception("SQLite migration for short_drama_render_jobs failed")


def _ensure_short_drama_project_step_columns() -> None:
    """Add last_active_step / step_status when table predates those fields (SQLite, PostgreSQL, etc.)."""
    try:
        insp = inspect(engine)
        if not insp.has_table("short_drama_projects"):
            return
        cols = {c["name"] for c in insp.get_columns("short_drama_projects")}
        dialect = engine.dialect.name
        alters: list[str] = []
        if "last_active_step" not in cols:
            if dialect == "postgresql":
                alters.append(
                    "ALTER TABLE short_drama_projects ADD COLUMN IF NOT EXISTS last_active_step VARCHAR"
                )
            else:
                alters.append("ALTER TABLE short_drama_projects ADD COLUMN last_active_step VARCHAR")
        if "step_status" not in cols:
            if dialect == "postgresql":
                alters.append(
                    "ALTER TABLE short_drama_projects ADD COLUMN IF NOT EXISTS step_status JSON"
                )
            else:
                alters.append("ALTER TABLE short_drama_projects ADD COLUMN step_status TEXT")
        if not alters:
            return
        with engine.begin() as conn:
            for stmt in alters:
                conn.execute(text(stmt))
        logger.info("Migration: short_drama_projects columns added (%s): %s", dialect, alters)
    except Exception:
        logger.exception("Migration for short_drama_projects step columns failed")


def _ensure_short_drama_asset_library_backfill() -> None:
    """Idempotent backfill: legacy single-image rows -> asset + image v2."""
    try:
        from .short_drama.models import (
            AssetEntity,
            AssetImage,
            CharacterAsset,
            ProductAsset,
            SceneAsset,
        )

        session = SessionLocal()
        try:
            def _normalize_role_type(raw):
                v = str(raw or "").strip().lower()
                if v in {"main", "protagonist", "lead", "hero"}:
                    return "main"
                if v in {"supporting", "support"}:
                    return "supporting"
                if v in {"antagonist", "villain"}:
                    return "antagonist"
                if v in {"extra", "background", "passerby", "crowd"}:
                    return "extra"
                return None

            def _normalize_scene_type(raw):
                v = str(raw or "").strip().lower()
                if v in {"hook", "opening", "intro", "start"}:
                    return "hook"
                if v in {"conflict", "build"}:
                    return "conflict"
                if v in {"turn", "twist"}:
                    return "turn"
                if v in {"resolution", "ending", "close"}:
                    return "resolution"
                return None

            def _normalize_scene_form(raw):
                v = str(raw or "").strip().lower()
                if v in {"interior", "indoor", "室内", "bedroom_interior", "interior office", "indoor_home"}:
                    return "interior"
                if v in {"exterior", "outdoor", "室外", "exterior_day", "exterior urban", "outdoor urban"}:
                    return "exterior"
                if v in {"montage", "montage_dynamic", "mixed interior exterior", "室内到室外"}:
                    return "montage"
                return None

            def _normalize_product_role(raw):
                v = str(raw or "").strip().lower()
                if v in {"hero", "main", "primary"}:
                    return "hero"
                if v in {"contrast", "compare", "comparison", "secondary"}:
                    return "contrast"
                if v in {"prop", "tool"}:
                    return "prop"
                if v in {"solution", "resolver"}:
                    return "solution"
                return None

            legacy_rows = []
            legacy_rows.extend(
                (
                    "character",
                    row.id,
                    row.project_id,
                    row.name,
                    row.description,
                    row.visual_prompt,
                    row.image_url,
                    row.meta_json or {},
                    {"role_type": _normalize_role_type(row.role_type) or "main"},
                )
                for row in session.query(CharacterAsset).order_by(CharacterAsset.id).all()
            )
            legacy_rows.extend(
                (
                    "scene",
                    row.id,
                    row.project_id,
                    row.name,
                    row.description,
                    row.visual_prompt,
                    row.image_url,
                    row.meta_json or {},
                    {
                        "scene_type": _normalize_scene_type(row.scene_type),
                        "scene_form": _normalize_scene_form(row.scene_type),
                    },
                )
                for row in session.query(SceneAsset).order_by(SceneAsset.id).all()
            )
            legacy_rows.extend(
                (
                    "product",
                    row.id,
                    row.project_id,
                    row.name,
                    row.description,
                    row.visual_prompt,
                    row.image_url,
                    row.meta_json or {},
                    {"product_role": _normalize_product_role((row.meta_json or {}).get("product_role")) or "hero"},
                )
                for row in session.query(ProductAsset).order_by(ProductAsset.id).all()
            )
            for asset_type, legacy_id, project_id, name, description, prompt, image_url, meta_json, base_fields in legacy_rows:
                extra = dict(meta_json or {})
                extra.setdefault("legacy_source", {"table_asset_id": legacy_id, "asset_type": asset_type})
                tf = dict(base_fields or {})
                tf.update(dict(meta_json or {}))
                if asset_type == "product":
                    tf["product_role"] = _normalize_product_role(tf.get("product_role")) or "hero"
                if asset_type == "character":
                    tf["role_type"] = _normalize_role_type(tf.get("role_type")) or "main"
                if asset_type == "scene":
                    normalized_scene_type = _normalize_scene_type(tf.get("scene_type"))
                    normalized_scene_form = _normalize_scene_form(tf.get("scene_form") or tf.get("scene_type"))
                    if normalized_scene_type:
                        tf["scene_type"] = normalized_scene_type
                    else:
                        tf.pop("scene_type", None)
                    if normalized_scene_form:
                        tf["scene_form"] = normalized_scene_form
                extra["type_fields"] = tf
                candidates = (
                    session.query(AssetEntity)
                    .filter(
                        AssetEntity.project_id == project_id,
                        AssetEntity.asset_type == asset_type,
                        AssetEntity.name == (name or ""),
                    )
                    .all()
                )
                exists = None
                for c in candidates:
                    c_extra = c.extra_json or {}
                    legacy = c_extra.get("legacy_source") if isinstance(c_extra, dict) else None
                    if isinstance(legacy, dict) and int(legacy.get("table_asset_id", -1)) == int(legacy_id):
                        exists = c
                        break
                if exists:
                    continue
                asset = AssetEntity(
                    project_id=project_id,
                    asset_type=asset_type,
                    name=name or f"{asset_type}-{legacy_id}",
                    description=description,
                    base_prompt=prompt,
                    source="system_generated",
                    tags_json=[],
                    extra_json=extra,
                )
                session.add(asset)
                session.flush()
                if image_url and str(image_url).strip():
                    image = AssetImage(
                        asset_id=asset.id,
                        image_url=str(image_url).strip(),
                        image_type="generated",
                        variant_label="legacy-import-1",
                        variant_meta={},
                        prompt_snapshot=prompt,
                        provider="legacy",
                        provider_params={},
                        is_cover=True,
                    )
                    session.add(image)
                    session.flush()
                    asset.cover_image_id = image.id
                    session.add(asset)
                extra2 = dict(asset.extra_json or {})
                tf2 = dict(extra2.get("type_fields") or {})
                if asset.cover_image_id:
                    tf2["visual_anchor_image_id"] = int(asset.cover_image_id)
                extra2["type_fields"] = tf2
                asset.extra_json = extra2
                session.add(asset)
            session.commit()
        finally:
            session.close()
    except Exception:
        logger.exception("Migration for short drama asset library backfill failed")


def _ensure_short_drama_product_context_columns() -> None:
    """Add S1 parse-layer columns when table predates image-understanding refactor."""
    try:
        insp = inspect(engine)
        if not insp.has_table("short_drama_product_contexts"):
            return
        cols = {c["name"] for c in insp.get_columns("short_drama_product_contexts")}
        dialect = engine.dialect.name
        alters: list[str] = []
        if "image_understanding_json" not in cols:
            if dialect == "postgresql":
                alters.append(
                    "ALTER TABLE short_drama_product_contexts ADD COLUMN IF NOT EXISTS image_understanding_json JSON"
                )
            else:
                alters.append("ALTER TABLE short_drama_product_contexts ADD COLUMN image_understanding_json TEXT")
        if "parse_status" not in cols:
            if dialect == "postgresql":
                alters.append(
                    "ALTER TABLE short_drama_product_contexts ADD COLUMN IF NOT EXISTS parse_status VARCHAR DEFAULT 'success'"
                )
            else:
                alters.append(
                    "ALTER TABLE short_drama_product_contexts ADD COLUMN parse_status VARCHAR DEFAULT 'success'"
                )
        if "updated_at" not in cols:
            if dialect == "postgresql":
                alters.append(
                    "ALTER TABLE short_drama_product_contexts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"
                )
            else:
                alters.append("ALTER TABLE short_drama_product_contexts ADD COLUMN updated_at TIMESTAMP")
        if not alters:
            return
        with engine.begin() as conn:
            for stmt in alters:
                conn.execute(text(stmt))
        logger.info("Migration: short_drama_product_contexts columns added (%s): %s", dialect, alters)
    except Exception:
        logger.exception("Migration for short_drama_product_contexts columns failed")


def _ensure_user_admin_columns() -> None:
    """Add role / status (account_status) for admin RBAC and account lifecycle."""
    table_name = "users"
    try:
        insp = inspect(engine)
        dialect = engine.dialect.name
        if not insp.has_table(table_name):
            return
        cols = {c["name"] for c in insp.get_columns(table_name)}
        alters: list[str] = []
        if "role" not in cols:
            if dialect == "postgresql":
                alters.append(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'user'"
                )
            else:
                alters.append("ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'user'")
        if "status" not in cols:
            if dialect == "postgresql":
                alters.append(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'normal'"
                )
            else:
                alters.append("ALTER TABLE users ADD COLUMN status VARCHAR NOT NULL DEFAULT 'normal'")
        if "subscription_status" not in cols:
            if dialect == "postgresql":
                alters.append(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR NOT NULL DEFAULT 'inactive'"
                )
            else:
                alters.append(
                    "ALTER TABLE users ADD COLUMN subscription_status VARCHAR NOT NULL DEFAULT 'inactive'"
                )
        if "subscription_plan" not in cols:
            if dialect == "postgresql":
                alters.append("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR")
            else:
                alters.append("ALTER TABLE users ADD COLUMN subscription_plan VARCHAR")
        if not alters:
            return
        with engine.begin() as conn:
            for stmt in alters:
                conn.execute(text(stmt))
        logger.info("Migration: users admin columns added (%s): %s", dialect, alters)
    except Exception:
        logger.exception("Migration for users admin columns failed")


def _ensure_billing_columns() -> None:
    """Payment orders + subscription period columns for Alipay notify / billing UI."""
    try:
        insp = inspect(engine)
        dialect = engine.dialect.name
        if insp.has_table("payment_orders"):
            cols = {c["name"] for c in insp.get_columns("payment_orders")}
            alters: list[str] = []
            if "alipay_trade_no" not in cols:
                if dialect == "postgresql":
                    alters.append(
                        "ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS alipay_trade_no VARCHAR"
                    )
                else:
                    alters.append("ALTER TABLE payment_orders ADD COLUMN alipay_trade_no VARCHAR")
            if "wechat_transaction_id" not in cols:
                if dialect == "postgresql":
                    alters.append(
                        "ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS wechat_transaction_id VARCHAR"
                    )
                else:
                    alters.append("ALTER TABLE payment_orders ADD COLUMN wechat_transaction_id VARCHAR")
            if alters:
                with engine.begin() as conn:
                    for stmt in alters:
                        conn.execute(text(stmt))
                logger.info("Migration: payment_orders columns added (%s): %s", dialect, alters)
        if insp.has_table("users"):
            cols = {c["name"] for c in insp.get_columns("users")}
            alters: list[str] = []
            if "subscription_period" not in cols:
                if dialect == "postgresql":
                    alters.append(
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_period VARCHAR"
                    )
                else:
                    alters.append("ALTER TABLE users ADD COLUMN subscription_period VARCHAR")
            if "subscription_started_at" not in cols:
                if dialect == "postgresql":
                    alters.append(
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE"
                    )
                else:
                    alters.append("ALTER TABLE users ADD COLUMN subscription_started_at TIMESTAMP")
            if "subscription_current_period_end" not in cols:
                if dialect == "postgresql":
                    alters.append(
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE"
                    )
                else:
                    alters.append(
                        "ALTER TABLE users ADD COLUMN subscription_current_period_end TIMESTAMP"
                    )
            if alters:
                with engine.begin() as conn:
                    for stmt in alters:
                        try:
                            conn.execute(text(stmt))
                        except Exception as e:
                            if "duplicate column name" in str(e).lower():
                                continue
                            raise
                logger.info("Migration: users subscription period columns added (%s): %s", dialect, alters)
    except Exception:
        logger.exception("Migration for billing columns failed")


def _ensure_api_call_log_columns() -> None:
    """Add api_call_logs v1 extension columns used by admin analytics."""
    table_name = "api_call_logs"
    try:
        insp = inspect(engine)
        dialect = engine.dialect.name
        if not insp.has_table(table_name):
            return
        cols = {c["name"] for c in insp.get_columns(table_name)}
        alters: list[str] = []
        if "file_size" not in cols:
            if dialect == "postgresql":
                alters.append("ALTER TABLE api_call_logs ADD COLUMN IF NOT EXISTS file_size INTEGER")
            else:
                alters.append("ALTER TABLE api_call_logs ADD COLUMN file_size INTEGER")
        if "object_key" not in cols:
            if dialect == "postgresql":
                alters.append("ALTER TABLE api_call_logs ADD COLUMN IF NOT EXISTS object_key VARCHAR")
            else:
                alters.append("ALTER TABLE api_call_logs ADD COLUMN object_key VARCHAR")
        if not alters:
            return
        with engine.begin() as conn:
            for stmt in alters:
                try:
                    conn.execute(text(stmt))
                except Exception as e:
                    # SQLite concurrent startup can race and hit duplicate column.
                    if "duplicate column name" in str(e).lower():
                        continue
                    raise
        logger.info("Migration: api_call_logs columns added (%s): %s", dialect, alters)
    except Exception:
        logger.exception("Migration for api_call_logs columns failed")


def init_db():
    """Initialize database tables - models must be imported before calling this"""
    Base.metadata.create_all(bind=engine)
    _ensure_user_admin_columns()
    _ensure_billing_columns()
    _ensure_api_call_log_columns()
    _sqlite_ensure_render_job_columns()
    _ensure_short_drama_project_step_columns()
    ensure_short_drama_project_columns(engine)
    _ensure_short_drama_asset_library_backfill()
    _ensure_short_drama_product_context_columns()
