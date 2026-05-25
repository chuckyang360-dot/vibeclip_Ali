from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import SegmentScriptRecord, ShortDramaProject
from ..providers.xai_text_provider import XAITextProvider, get_xai_text_provider
from ..schemas.project import ScriptImportInput
from ..schemas.segment import SegmentScriptSchema
from ..services.project_state_service import STEP_1, STEP_2, STEP_3, STEP_4, mark_step_completed, update_last_active_step
from ..services.read_models import next_segment_batch_version
from ..utils.ai_runtime_config import (
    STAGE_SCRIPT_IMPORT_PARSE,
    apply_runtime_user_prompt_template,
    get_ai_runtime_config,
)
from ..utils.enums import ProjectStatus
from .creative_brief_service import update_s0_s1_state

logger = logging.getLogger(__name__)

SCRIPT_IMPORT_SYSTEM_PROMPT = """You parse a user-provided video script/prompt/template into executable short-video segments.
Output ONLY one JSON object. No markdown, no code fences, no commentary.

The user input can be a prompt template, full script, storyboard, outline, or mixed notes.
Preserve strong user constraints. Improve missing operational detail only when needed for video generation.
Do not invent product claims, certifications, prices, or facts.

Required JSON shape:
{
  "analysis": {
    "input_type": "full_script | storyboard | prompt_template | outline | mixed | invalid",
    "confidence": 0.0,
    "detected_language": "string",
    "missing_fields": ["string"],
    "global_style": "string",
    "constraints": ["string"],
    "summary": "string"
  },
  "segments": [
    {
      "segment_id": "1",
      "title": "string",
      "goal": "string",
      "duration_limit": 6,
      "shots": [
        {
          "shot_id": "shot_1",
          "shot_role": "string",
          "visual_action": "string",
          "action_description": "string",
          "scene_description": "string",
          "camera_description": "string",
          "spoken_text": "string",
          "voiceover_text": "string",
          "subtitle_text": "string",
          "audio_intent": "string",
          "duration_seconds": 6,
          "video_prompt": "complete visual generation prompt for this shot/segment",
          "must_show": ["string"],
          "must_avoid": ["string"]
        }
      ]
    }
  ]
}

Rules:
- Create 1-8 segments.
- Each segment duration_limit must be between 1 and 10 seconds.
- Each segment should contain 1-3 shots.
- Every shot must have non-empty video_prompt and action_description.
- If dialogue/voiceover is absent, use empty string.
- Keep JSON keys in English. Use the user's language for user-facing values.
"""


def _clean_text(value: Any, max_chars: int = 24_000) -> str:
    text = re.sub(r"\s+", " ", str(value or "").replace("\r", "\n")).strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 20].rstrip() + " ...[truncated]"


def _safe_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(x).strip() for x in value if str(x or "").strip()]


def _clip_duration(value: Any, fallback: float = 6.0) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        n = fallback
    if n <= 0:
        n = fallback
    return max(1.0, min(10.0, n))


def _fallback_parse(body: ScriptImportInput) -> dict[str, Any]:
    text = _clean_text(body.raw_text, max_chars=1800)
    chunks = [x.strip(" -\n\t") for x in re.split(r"(?:\n+|。|；|;)", body.raw_text) if x.strip()]
    if not chunks:
        chunks = [text]
    chunks = chunks[:5]
    segments = []
    for idx, chunk in enumerate(chunks, start=1):
        prompt = _clean_text(chunk, max_chars=700)
        segments.append(
            {
                "segment_id": str(idx),
                "title": f"片段 {idx}",
                "goal": prompt[:120],
                "duration_limit": 6,
                "shots": [
                    {
                        "shot_id": "shot_1",
                        "shot_role": "剧本导入",
                        "visual_action": prompt,
                        "action_description": prompt,
                        "scene_description": "",
                        "camera_description": "",
                        "spoken_text": "",
                        "voiceover_text": "",
                        "subtitle_text": "",
                        "audio_intent": "",
                        "duration_seconds": 6,
                        "video_prompt": prompt,
                        "must_show": [],
                        "must_avoid": [],
                    }
                ],
            }
        )
    return {
        "analysis": {
            "input_type": "mixed",
            "confidence": 0.45,
            "detected_language": "auto",
            "missing_fields": ["AI 解析不可用，已按原文切片"],
            "global_style": "",
            "constraints": [],
            "summary": text[:240],
        },
        "segments": segments,
    }


def _normalize_analysis(raw: Any) -> dict[str, Any]:
    src = raw if isinstance(raw, dict) else {}
    try:
        confidence = float(src.get("confidence") or 0)
    except (TypeError, ValueError):
        confidence = 0.0
    return {
        "input_type": str(src.get("input_type") or "mixed").strip() or "mixed",
        "confidence": max(0.0, min(1.0, confidence)),
        "detected_language": str(src.get("detected_language") or "").strip(),
        "missing_fields": _safe_list(src.get("missing_fields")),
        "global_style": str(src.get("global_style") or "").strip(),
        "constraints": _safe_list(src.get("constraints")),
        "summary": str(src.get("summary") or "").strip(),
    }


def _presentation_shot(shot: dict[str, Any], index: int) -> dict[str, Any]:
    return {
        "shot_id": str(shot.get("shot_id") or f"shot_{index}").strip(),
        "shot_index": index,
        "shot_role": str(shot.get("shot_role") or "").strip(),
        "viewer_takeaway": str(shot.get("viewer_takeaway") or shot.get("action_description") or "").strip(),
        "visual_direction": str(shot.get("visual_action") or shot.get("video_prompt") or "").strip(),
        "character_action": str(shot.get("action_description") or shot.get("visual_action") or "").strip(),
        "product_presence": str(shot.get("product_presence") or "").strip(),
        "product_purpose": str(shot.get("product_purpose") or "").strip(),
        "scene_direction": str(shot.get("scene_description") or "").strip(),
        "camera_direction": str(shot.get("camera_description") or shot.get("camera") or "").strip(),
        "dialogue_text": str(shot.get("spoken_text") or shot.get("dialogue") or "").strip(),
        "voiceover_text": str(shot.get("voiceover_text") or shot.get("voiceover") or "").strip(),
        "subtitle_text": str(shot.get("subtitle_text") or shot.get("subtitle") or "").strip(),
        "audio_intent": str(shot.get("audio_intent") or shot.get("mood") or "").strip(),
        "duration_sec": _clip_duration(shot.get("duration_sec") or shot.get("duration_seconds"), fallback=6.0),
        "character_refs": _safe_list(shot.get("character_refs")),
        "character_asset_ids": [],
        "scene_refs": _safe_list(shot.get("scene_refs")),
        "scene_asset_id": "",
        "product_refs": _safe_list(shot.get("product_refs")),
        "product_asset_id": "",
    }


def _normalize_segments(raw_segments: Any, analysis: dict[str, Any]) -> list[SegmentScriptSchema]:
    if not isinstance(raw_segments, list) or not raw_segments:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="剧本解析结果没有可用片段。")
    out: list[SegmentScriptSchema] = []
    for idx, raw in enumerate(raw_segments[:8], start=1):
        row = raw if isinstance(raw, dict) else {}
        shots_raw = row.get("shots") if isinstance(row.get("shots"), list) else []
        shots = []
        for sidx, shot_raw in enumerate(shots_raw[:3], start=1):
            shot = shot_raw if isinstance(shot_raw, dict) else {}
            action = str(shot.get("action_description") or shot.get("visual_action") or "").strip()
            video_prompt = str(shot.get("video_prompt") or shot.get("generation_prompt") or action).strip()
            if not video_prompt:
                continue
            duration = _clip_duration(shot.get("duration_seconds") or shot.get("duration_sec"), fallback=6.0)
            shots.append(
                {
                    **shot,
                    "shot_id": str(shot.get("shot_id") or f"shot_{sidx}").strip(),
                    "action_description": action or video_prompt,
                    "visual_action": str(shot.get("visual_action") or action or video_prompt).strip(),
                    "duration_seconds": duration,
                    "duration_sec": duration,
                    "video_prompt": video_prompt,
                    "generation_prompt": video_prompt,
                    "manual_video_prompt": video_prompt,
                    "character_asset_ids": [],
                    "scene_asset_id": "",
                    "product_asset_id": "",
                    "source_visual_constraints": {"assetless_script_import": True},
                }
            )
        if not shots:
            continue
        seg_id = str(row.get("segment_id") or idx).strip()
        if not seg_id.startswith("seg_"):
            seg_id = f"seg_{seg_id}"
        out.append(
            SegmentScriptSchema.model_validate(
                {
                    "segment_id": seg_id,
                    "title": str(row.get("title") or f"片段 {idx}").strip(),
                    "goal": str(row.get("goal") or row.get("title") or "").strip(),
                    "duration_limit": _clip_duration(row.get("duration_limit"), fallback=sum(s["duration_seconds"] for s in shots)),
                    "shots": shots,
                    "meta": {
                        "workflow_mode": "script_import",
                        "source": "script_import_parser",
                        "assetless_video_generation": True,
                        "script_import_analysis": analysis,
                    },
                }
            )
        )
    if not out:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="剧本解析结果没有可用镜头。")
    return out


def _script_payload(seg: SegmentScriptSchema) -> dict[str, Any]:
    raw = seg.model_dump()
    execution_shots = [dict(s) for s in raw.get("shots") or [] if isinstance(s, dict)]
    return {
        **raw,
        "shots": execution_shots,
        "execution_shots": execution_shots,
        "presentation_shots": [_presentation_shot(s, idx + 1) for idx, s in enumerate(execution_shots)],
    }


class ScriptImportService:
    def __init__(self, text_provider: XAITextProvider | None = None):
        self._text = text_provider or get_xai_text_provider()

    def prepare(self, db: Session, project_id: int, body: ScriptImportInput) -> dict[str, Any]:
        project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        raw_text = _clean_text(body.raw_text)
        if len(raw_text) < 4:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请上传或粘贴更完整的剧本内容。")

        payload = {
            "project_id": project_id,
            "file_name": body.file_name,
            "raw_text": raw_text,
            "hints": {
                "platform_hints": body.platform_hints,
                "duration_hint": body.duration_hint,
                "aspect_ratio_hint": body.aspect_ratio_hint,
                "strict_mode": body.strict_mode,
            },
        }
        ai_cfg = get_ai_runtime_config(STAGE_SCRIPT_IMPORT_PARSE)
        effective_system_prompt = ai_cfg.system_prompt or SCRIPT_IMPORT_SYSTEM_PROMPT
        effective_payload = apply_runtime_user_prompt_template(
            user_payload=payload,
            template=ai_cfg.user_prompt_template,
            payload_placeholder="script_import_payload",
            values={
                "project_id": project_id,
                "file_name": body.file_name,
            },
        )
        effective_model = (ai_cfg.model_id or "").strip() or None
        effective_provider = (ai_cfg.provider or "").strip().lower() or None
        stage_config = ai_cfg.stage_config if isinstance(ai_cfg.stage_config, dict) else {}
        use_proxy_default_model = bool(
            stage_config.get("use_proxy_default_model", (effective_provider or "") == "gemini")
        )
        try:
            max_output_tokens = int(stage_config.get("max_output_tokens") or 8192)
        except (TypeError, ValueError):
            max_output_tokens = 8192
        logger.info(
            "[SCRIPT_IMPORT_AI_CONFIG] project_id=%s provider=%s model=%s proxy_model=%s prompt_template_id=%s prompt_version=%s max_output_tokens=%s",
            project_id,
            effective_provider or "",
            effective_model or "",
            "(proxy_default)" if use_proxy_default_model else (effective_model or ""),
            ai_cfg.prompt_template_id,
            ai_cfg.prompt_version,
            max_output_tokens,
        )
        try:
            parsed = self._text.generate_structured_json(
                project_id=project_id,
                service_name="script_import",
                system_prompt=effective_system_prompt,
                user_payload=effective_payload,
                image_urls=None,
                expected_schema_name="ScriptImportParse",
                stage="SCRIPT_IMPORT_PARSE",
                model=effective_model,
                provider=effective_provider,
                max_output_tokens=max_output_tokens,
                use_proxy_default_model=use_proxy_default_model,
            )
        except Exception:
            logger.exception("[SCRIPT_IMPORT_AI_PARSE_FAILED] project_id=%s fallback=true", project_id)
            parsed = _fallback_parse(body)

        analysis = _normalize_analysis((parsed or {}).get("analysis") if isinstance(parsed, dict) else {})
        try:
            segments = _normalize_segments((parsed or {}).get("segments") if isinstance(parsed, dict) else [], analysis)
        except HTTPException:
            logger.warning("[SCRIPT_IMPORT_PARSE_INVALID] project_id=%s fallback=true", project_id)
            parsed = _fallback_parse(body)
            analysis = _normalize_analysis(parsed.get("analysis"))
            segments = _normalize_segments(parsed.get("segments"), analysis)
        batch_ver = next_segment_batch_version(db, project_id)
        db.query(SegmentScriptRecord).filter(SegmentScriptRecord.project_id == project_id).delete(synchronize_session=False)
        record_ids: list[int] = []
        for seg in segments:
            row = SegmentScriptRecord(
                project_id=project_id,
                segment_id=seg.segment_id,
                script_json=_script_payload(seg),
                version=batch_ver,
            )
            db.add(row)
            db.flush()
            record_ids.append(row.id)

        script_state = {
            "source": {
                "file_name": body.file_name,
                "raw_text": raw_text,
                "content_hash": hashlib.sha256(raw_text.encode("utf-8")).hexdigest(),
            },
            "analysis": analysis,
            "parse_status": "completed",
            "segment_count": len(segments),
        }
        status_map = update_s0_s1_state(project, {"script_import": script_state, "workflow_mode": "script_import"})
        status_map[STEP_1] = "completed"
        status_map[STEP_2] = "skipped"
        status_map[STEP_3] = "skipped"
        project.step_status = status_map
        project.creative_intent = analysis.get("summary") or raw_text[:280]
        project.duration = body.duration_hint or project.duration
        project.aspect_ratio = body.aspect_ratio_hint or project.aspect_ratio
        project.status = ProjectStatus.SEGMENTS_GENERATED.value
        mark_step_completed(project, STEP_4)
        update_last_active_step(project, STEP_4)
        db.add(project)
        db.commit()
        logger.info(
            "[SCRIPT_IMPORT_PREPARED] project_id=%s segment_count=%s confidence=%s file_name=%s",
            project_id,
            len(segments),
            analysis.get("confidence"),
            body.file_name,
        )
        return {
            "project_id": project_id,
            "analysis": analysis,
            "segment_count": len(segments),
            "record_ids": record_ids,
            "redirect_to": f"/short-drama/projects/{project_id}/step-4",
        }


script_import_service = ScriptImportService()
