import { useEffect, useMemo, useRef, useState } from "react";
import type { Step4RenderProgressMap, Step4SegmentItem, Step4Shot, Step4VideoStatusMap } from "@/types/shortDrama";
import type { UpdateSegmentShotBody } from "@/types/shortDramaApi";
import type { StepFourAssetLibraryVm } from "../utils/stepFourAdapters";

type RefKind = "characters" | "scene" | "products";

type ShotDraft = {
  shotRole: string;
  viewerTakeaway: string;
  visualDirection: string;
  characterDirection: string;
  productPresence: string;
  productPurpose: string;
  sceneDirection: string;
  cameraDirection: string;
  action: string;
  spokenText: string;
  voiceoverText: string;
  subtitleText: string;
  dialogueSource?: Step4Shot["dialogueSource"];
  emotion: string;
  videoPrompt: string;
  manualVideoPrompt: string;
  mustShowText: string;
  mustAvoidText: string;
  durationSeconds: number;
  characterRefs: string[];
  characterAssetIds: string[];
  sceneRef: string;
  sceneAssetId: string;
  productRefs: string[];
  productAssetId: string;
};

type SegmentDraft = {
  title: string;
  goal: string;
  durationLimit: number;
  productionPrompt: string;
  sourceExcerpt: string;
  shots: Record<number, ShotDraft>;
};

type AssetChip = {
  key: string;
  name: string;
  img: string | null;
};
type AssetOption = {
  id: string;
  name: string;
  subtitle: string;
  img: string | null;
};

type SelectorSaveValue = {
  refs: string[];
  assetIds: string[];
};

interface SegmentWorkbenchProps {
  segments: Step4SegmentItem[];
  activeSegment: number;
  videoStatus: Step4VideoStatusMap;
  renderProgressMap: Step4RenderProgressMap;
  assetLibrary: StepFourAssetLibraryVm;
  onSegmentChange: (id: number) => void;
  onGenerateVideo: (segId: number) => void;
  onSaveSegmentShot: (
    segId: number,
    shotId: string,
    body: Omit<UpdateSegmentShotBody, "project_id">,
  ) => Promise<unknown>;
  videoGenerateDisabled?: boolean;
  scriptImportMode?: boolean;
  videoLanguage?: string | null;
  onDirtyChange?: () => void;
}

export function StepFourSegmentWorkbench({
  segments,
  activeSegment,
  videoStatus,
  renderProgressMap,
  assetLibrary,
  onSegmentChange,
  onGenerateVideo,
  onSaveSegmentShot,
  videoGenerateDisabled = false,
  scriptImportMode = false,
  videoLanguage = null,
  onDirtyChange,
}: SegmentWorkbenchProps) {
  const [expandedShot, setExpandedShot] = useState<number | null>(null);
  const [expandedSegmentIds, setExpandedSegmentIds] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<Record<number, boolean>>({});
  const [drafts, setDrafts] = useState<Record<number, SegmentDraft>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});
  const [selector, setSelector] = useState<{ segId: number; shotId: number; kind: RefKind } | null>(null);
  const defaultExpandedInitialized = useRef(false);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const seg of segments) {
        if (!next[seg.id] || !editing[seg.id]) next[seg.id] = makeSegmentDraft(seg);
      }
      return next;
    });
  }, [segments, editing]);

  useEffect(() => {
    setExpandedSegmentIds((prev) => {
      const validIds = new Set(segments.map((seg) => seg.id));
      const next = Object.fromEntries(
        Object.entries(prev)
          .map(([key, value]) => [Number(key), value] as const)
          .filter(([id]) => validIds.has(id)),
      ) as Record<number, boolean>;
      if (!defaultExpandedInitialized.current && segments[0]) {
        next[segments[0].id] = true;
        defaultExpandedInitialized.current = true;
      }
      return next;
    });
  }, [segments]);

  const dirtyMap = useMemo(() => {
    const out: Record<number, boolean> = {};
    for (const seg of segments) {
      const draft = drafts[seg.id];
      out[seg.id] = !!draft && JSON.stringify(draft) !== JSON.stringify(makeSegmentDraft(seg));
    }
    return out;
  }, [drafts, segments]);

  useEffect(() => {
    const hasUnsaved = Object.values(dirtyMap).some(Boolean) || Object.values(editing).some(Boolean);
    if (hasUnsaved) onDirtyChange?.();
  }, [dirtyMap, editing, onDirtyChange]);

  const updateSegmentDraft = (seg: Step4SegmentItem, patch: Partial<SegmentDraft>) => {
    setDrafts((prev) => ({ ...prev, [seg.id]: { ...(prev[seg.id] ?? makeSegmentDraft(seg)), ...patch } }));
    setSaved((prev) => ({ ...prev, [seg.id]: false }));
  };

  const updateShotDraft = (seg: Step4SegmentItem, shotId: number, patch: Partial<ShotDraft>) => {
    setDrafts((prev) => {
      const draft = prev[seg.id] ?? makeSegmentDraft(seg);
      const shot = draft.shots[shotId] ?? makeShotDraft(seg.shots.find((s) => s.id === shotId) ?? seg.shots[0]);
      return {
        ...prev,
        [seg.id]: {
          ...draft,
          shots: { ...draft.shots, [shotId]: { ...shot, ...patch } },
        },
      };
    });
    setSaved((prev) => ({ ...prev, [seg.id]: false }));
  };

  const saveSegment = async (seg: Step4SegmentItem) => {
    const draft = drafts[seg.id] ?? makeSegmentDraft(seg);
    const dirtyShots = seg.shots.filter((shot) => {
      const current = draft.shots[shot.id];
      return current && JSON.stringify(current) !== JSON.stringify(makeShotDraft(shot));
    });
    const targets = dirtyShots.length ? dirtyShots : seg.shots.slice(0, 1);
    if (!targets.length) return;
    setSaving((prev) => ({ ...prev, [seg.id]: true }));
    setErrors((prev) => ({ ...prev, [seg.id]: null }));
    try {
      for (const shot of targets) {
        const sd = draft.shots[shot.id] ?? makeShotDraft(shot);
        await onSaveSegmentShot(seg.id, shot.backendShotId, {
          segment_title: draft.title,
          segment_goal: draft.goal,
          duration_limit: draft.durationLimit,
          production_prompt: draft.productionPrompt,
          source_excerpt: draft.sourceExcerpt,
          action_description: sd.action,
          spoken_text: sd.spokenText,
          voiceover_text: sd.voiceoverText,
          subtitle_text: sd.subtitleText,
          emotion: sd.emotion,
          generation_prompt: sd.videoPrompt,
          manual_video_prompt: sd.manualVideoPrompt,
          must_show: splitList(sd.mustShowText),
          must_avoid: splitList(sd.mustAvoidText),
          duration_seconds: sd.durationSeconds,
          duration_sec: sd.durationSeconds,
          shot_role: sd.shotRole,
          viewer_takeaway: sd.viewerTakeaway,
          visual_direction: sd.visualDirection,
          character_direction: sd.characterDirection,
          product_presence: sd.productPresence,
          product_purpose: sd.productPurpose,
          scene_direction: sd.sceneDirection,
          camera_direction: sd.cameraDirection,
          dialogue_text: sd.spokenText,
          subtitle_text_presentation: sd.subtitleText,
          audio_intent: sd.emotion,
          character_refs: sd.characterRefs,
          character_asset_ids: sd.characterAssetIds,
          scene_refs: sd.sceneRef ? [sd.sceneRef] : [],
          scene_asset_id: sd.sceneAssetId || undefined,
          product_refs: sd.productRefs,
          product_asset_id: sd.productAssetId || undefined,
          manual_character_refs: sd.characterRefs,
          manual_scene_ref: sd.sceneRef,
          manual_product_refs: sd.productRefs,
        });
      }
      setEditing((prev) => ({ ...prev, [seg.id]: false }));
      setSaved((prev) => ({ ...prev, [seg.id]: true }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [seg.id]: e instanceof Error ? e.message : "保存失败，请稍后重试" }));
    } finally {
      setSaving((prev) => ({ ...prev, [seg.id]: false }));
    }
  };

  const cancelEdit = (seg: Step4SegmentItem) => {
    setDrafts((prev) => ({ ...prev, [seg.id]: makeSegmentDraft(seg) }));
    setEditing((prev) => ({ ...prev, [seg.id]: false }));
    setErrors((prev) => ({ ...prev, [seg.id]: null }));
  };

  const generateSegment = (seg: Step4SegmentItem) => {
    if (dirtyMap[seg.id] || editing[seg.id]) {
      setErrors((prev) => ({ ...prev, [seg.id]: "当前片段有未保存修改，请先保存后再重新生成。" }));
      return;
    }
    onGenerateVideo(seg.id);
  };

  return (
    <div className="flex-1 overflow-y-auto p-5" style={{ background: "#ffffff" }}>
      <div className="space-y-3">
        {segments.map((seg) => {
          const isSelected = seg.id === activeSegment;
          const isExpanded = !!expandedSegmentIds[seg.id];
          const vStatus = videoStatus[seg.id] || "idle";
          const rProgress = renderProgressMap[seg.id] ?? null;
          const draft = drafts[seg.id] ?? makeSegmentDraft(seg);
          const isEditing = !!editing[seg.id];
          const isDirty = !!dirtyMap[seg.id];

          return (
            <div
              key={seg.id}
              id={`segment-${seg.id}`}
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: isSelected ? "#ffffff" : "#F7F8FA",
                border: isSelected ? `1.5px solid ${seg.color}40` : "1px solid #EAEAEA",
                boxShadow: isSelected ? `0 2px 12px ${seg.color}12` : "none",
              }}
            >
              <button
                type="button"
                className="w-full p-4 flex items-center justify-between cursor-pointer"
                onClick={() => {
                  onSegmentChange(seg.id);
                  setExpandedSegmentIds((prev) => ({ ...prev, [seg.id]: !prev[seg.id] }));
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg text-[11px] font-bold shrink-0" style={{ background: `${seg.color}12`, color: seg.color }}>
                    S{seg.id}
                  </div>
                  <div className="text-left">
                    <p className="text-[13.5px] font-bold" style={{ color: "#1D1D1F" }}>{draft.title}</p>
                    <p className="text-[11px]" style={{ color: "#8E8E93" }}>{draft.durationLimit || seg.duration}秒 · {draft.goal}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isDirty && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(180,83,9,0.08)", color: "#B45309" }}>未保存</span>}
                  {vStatus === "completed" && !isSelected && <i className="ri-checkbox-circle-fill text-[12px]" style={{ color: "#047857" }} />}
                  <i className={isExpanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} style={{ color: "#AEAEB2" }} />
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-[1fr_1fr_120px] gap-3 rounded-xl p-3" style={{ background: "#FAFAFB", border: "1px solid #EAEAEA" }}>
                    <Field label="片段名称" value={draft.title} editing={isEditing} onChange={(v) => updateSegmentDraft(seg, { title: v })} />
                    <Field label="片段目标" value={draft.goal} editing={isEditing} onChange={(v) => updateSegmentDraft(seg, { goal: v })} />
                    <NumberField label="片段时长" value={draft.durationLimit} editing={isEditing} onChange={(v) => updateSegmentDraft(seg, { durationLimit: v })} />
                  </div>
                  {scriptImportMode && (
                    <div className="rounded-xl p-3 space-y-3" style={{ background: "#FAFAFB", border: "1px solid #EAEAEA" }}>
                      <Field
                        label="视频生成 PMT"
                        value={draft.productionPrompt}
                        editing={isEditing}
                        multiline
                        onChange={(v) => updateSegmentDraft(seg, { productionPrompt: v })}
                      />
                      {(isEditing || draft.sourceExcerpt.trim()) && (
                        <Field
                          label="原文片段"
                          value={draft.sourceExcerpt}
                          editing={isEditing}
                          multiline
                          onChange={(v) => updateSegmentDraft(seg, { sourceExcerpt: v })}
                        />
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    {seg.shots.map((shot) => {
                      const sd = draft.shots[shot.id] ?? makeShotDraft(shot);
                      const shotActive = expandedShot === shot.id;
                      return (
                        <div key={shot.id} className="rounded-xl overflow-hidden transition-all duration-150" style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}>
                          <button type="button" className="w-full flex items-center justify-between px-3 py-2.5 text-left" onClick={() => setExpandedShot(shotActive ? null : shot.id)}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[12px] font-bold shrink-0" style={{ color: seg.color }}>镜头 {shot.id}</span>
                              {(vStatus === "queued" || vStatus === "running") && rProgress?.currentShot === shot.id && <i className="ri-loader-4-line text-[11px] animate-spin" style={{ color: seg.color }} />}
                              <span className="text-[12.5px] truncate" style={{ color: "#444444" }}>{sd.action || shot.desc}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#EAEAEA", color: "#6E6E73" }}>{sd.durationSeconds ? `${sd.durationSeconds}s` : shot.duration}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#F5F5F7", color: "#8E8E93" }}>{sd.emotion || "—"}</span>
                          </button>

                          {shotActive && (
                            <div className="px-3 pb-3 pt-3 space-y-3 text-[11.5px]" style={{ borderTop: "1px solid #EAEAEA" }}>
                              <ShotFields
                                seg={seg}
                                shot={shot}
                                draft={sd}
                                editing={isEditing}
                                videoLanguage={videoLanguage}
                                assetLibrary={assetLibrary}
                                onChange={(patch) => updateShotDraft(seg, shot.id, patch)}
                                onSelect={(kind) => setSelector({ segId: seg.id, shotId: shot.id, kind })}
                              />
                              <AdvancedSettings shot={shot} draft={sd} editing={isEditing} onChange={(patch) => updateShotDraft(seg, shot.id, patch)} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <SegmentActions
                    seg={seg}
                    status={vStatus}
                    hasVideoUrl={!!seg.videoUrl?.trim()}
                    progress={rProgress}
                    disabled={videoGenerateDisabled}
                    editing={isEditing}
                    dirty={isDirty}
                    saving={!!saving[seg.id]}
                    saved={!!saved[seg.id]}
                    error={errors[seg.id] ?? null}
                    onEdit={() => {
                      setEditing((prev) => ({ ...prev, [seg.id]: true }));
                      setErrors((prev) => ({ ...prev, [seg.id]: null }));
                    }}
                    onSave={() => void saveSegment(seg)}
                    onCancel={() => cancelEdit(seg)}
                    onGenerate={() => generateSegment(seg)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selector && (
        <ReferenceSelector
          selector={selector}
          library={assetLibrary}
          draft={drafts[selector.segId]}
          onClose={() => setSelector(null)}
          onSave={(values) => {
            const seg = segments.find((s) => s.id === selector.segId);
            if (!seg) return;
            if (selector.kind === "characters") {
              updateShotDraft(seg, selector.shotId, {
                characterRefs: values.refs,
                characterAssetIds: cleanAssetIds(values.assetIds),
              });
            } else if (selector.kind === "scene") {
              updateShotDraft(seg, selector.shotId, {
                sceneRef: values.refs[0] ?? "",
                sceneAssetId: cleanAssetIds(values.assetIds)[0] ?? "",
              });
            } else {
              updateShotDraft(seg, selector.shotId, {
                productRefs: values.refs,
                productAssetId: cleanAssetIds(values.assetIds)[0] ?? "",
              });
            }
            setSelector(null);
          }}
        />
      )}
    </div>
  );
}

function makeSegmentDraft(seg: Step4SegmentItem): SegmentDraft {
  return {
    title: seg.name,
    goal: seg.goal,
    durationLimit: seg.durationLimit,
    productionPrompt: seg.productionPrompt ?? "",
    sourceExcerpt: seg.sourceExcerpt ?? "",
    shots: Object.fromEntries(seg.shots.map((shot) => [shot.id, makeShotDraft(shot)])),
  };
}

function makeShotDraft(shot?: Step4Shot): ShotDraft {
  const characterRefs = shot?.manualCharacterRefs?.length ? shot.manualCharacterRefs : shot?.characterRefs ?? [];
  const cleanedCharacterRefs = characterRefs.map((x) => String(x || "").trim()).filter(Boolean);
  const characterAssetIds = cleanAssetIds(shot?.characterAssetIds);
  return {
    shotRole: shot?.shotRole ?? "",
    viewerTakeaway: shot?.viewerTakeaway ?? "",
    visualDirection: shot?.visualDirection ?? shot?.action ?? "",
    characterDirection: shot?.characterDirection ?? shot?.action ?? "",
    productPresence: shot?.productPresence ?? "",
    productPurpose: shot?.productPurpose ?? "",
    sceneDirection: shot?.sceneDirection ?? shot?.sceneDescription ?? "",
    cameraDirection: shot?.cameraDirection ?? shot?.cameraDescription ?? "",
    action: shot?.action ?? "",
    spokenText: shot?.spokenText ?? shot?.dialogue ?? "",
    voiceoverText: shot?.voiceoverText ?? shot?.voiceover ?? "",
    subtitleText: shot?.subtitleText ?? shot?.subtitle ?? "",
    dialogueSource: shot?.dialogueSource,
    emotion: shot?.emotion ?? "",
    videoPrompt: shot?.videoPrompt ?? "",
    manualVideoPrompt: shot?.manualVideoPrompt ?? "",
    mustShowText: (shot?.mustShow ?? []).join("；"),
    mustAvoidText: (shot?.mustAvoid ?? []).join("；"),
    durationSeconds: shot?.durationSeconds ?? 0,
    characterRefs: cleanedCharacterRefs.length ? [cleanedCharacterRefs[cleanedCharacterRefs.length - 1]] : [],
    characterAssetIds: characterAssetIds.length ? [characterAssetIds[characterAssetIds.length - 1]] : [],
    sceneRef: shot?.manualSceneRef || shot?.sceneRef || "",
    sceneAssetId: cleanAssetIds(shot?.sceneAssetId ? [shot.sceneAssetId] : [])[0] ?? "",
    productRefs: shot?.manualProductRefs?.length ? shot.manualProductRefs : shot?.productRefs ?? [],
    productAssetId: cleanAssetIds(shot?.productAssetId ? [shot.productAssetId] : [])[0] ?? "",
  };
}

function cleanAssetIds(values: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values ?? []) {
    const value = String(raw || "").trim();
    if (!/^\d+$/.test(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function splitList(text: string): string[] {
  return text.split(/[；;\n]/).map((x) => x.trim()).filter(Boolean);
}

const displayPrefixPatterns: RegExp[] = [
  /^\s*emotional_value\s*[:：]\s*/i,
  /^\s*user_pain_points\s*[:：]\s*/i,
  /^\s*core_selling_points\s*[:：]\s*/i,
  /^\s*source_selling_point\s*[:：]\s*/i,
  /^\s*product_presence\s*[:：]\s*/i,
  /^\s*product_purpose\s*[:：]\s*/i,
  /^\s*visual_action\s*[:：]\s*/i,
  /^\s*action_description\s*[:：]\s*/i,
  /^\s*scene_direction\s*[:：]\s*/i,
  /^\s*camera_direction\s*[:：]\s*/i,
  /^\s*character_action\s*[:：]\s*/i,
  /^\s*viewer_takeaway\s*[:：]\s*/i,
  /^\s*story_intent\s*[:：]\s*/i,
  /^\s*commercial_intent\s*[:：]\s*/i,
];

const displayEngineeringKeys = [
  "emotional_value",
  "core_selling_points",
  "user_pain_points",
  "product_purpose",
  "product_presence",
  "source_selling_point",
  "visual_action",
  "action_description",
  "scene_direction",
  "camera_direction",
  "character_action",
  "viewer_takeaway",
  "story_intent",
  "commercial_intent",
] as const;

const displayProductPresenceMap: Record<string, string> = {
  none: "商品暂不出现",
  implied: "暗示商品相关",
  background: "商品作为背景出现",
  visible: "商品可见",
  explicit: "商品明确出现",
  hero: "商品作为主角展示",
};

function normalizeDisplayText(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";

  const parseOne = (segment: string): string => {
    const m = segment.match(/^\s*([a-z_]+)\s*[:：]\s*(.*?)\s*$/i);
    if (!m) return segment;
    const key = m[1].toLowerCase();
    const value = String(m[2] || "").trim();
    if (!value) return "";
    if (key === "product_presence") return displayProductPresenceMap[value.toLowerCase()] || value;
    if ((displayEngineeringKeys as readonly string[]).includes(key)) return value;
    return segment;
  };

  let text = raw
    .split(/[;\n；]+/)
    .map((x) => parseOne(x.trim()))
    .filter(Boolean)
    .join("；")
    .trim();
  if (!text) return "";
  for (const p of displayPrefixPatterns) text = text.replace(p, "");
  text = text.replace(/，/g, "、").replace(/\s+/g, " ").trim();
  text = text.replace(/\bMCM\b\s*品牌?/gi, "品牌质感").replace(/\bMCM\b/gi, "品牌风格");
  // 兜底：不允许主展示残留工程 key 名
  const remained = new RegExp(`\\b(${displayEngineeringKeys.join("|")})\\b\\s*[:：]?`, "gi");
  text = text.replace(remained, "").replace(/\s+/g, " ").trim();
  return text;
}

function productPresenceLabel(value: string): string {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "未指定";
  return displayProductPresenceMap[key] || normalizeDisplayText(value);
}

function shotRoleLabel(value: string): string {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "未指定";
  const map: Record<string, string> = {
    hook: "开场吸引",
    build: "情节推进",
    reveal: "信息揭示",
    payoff: "结果收束",
  };
  return map[key] || normalizeDisplayText(value);
}

function audioStatusLabel(value: string): string {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "待处理";
  const map: Record<string, string> = {
    pending_tts_or_dubbing: "待配音",
    none: "无需音频",
    done: "已完成",
    failed: "处理失败",
  };
  return map[key] || normalizeDisplayText(value);
}

function Field({ label, value, editing, multiline = false, onChange }: { label: string; value: string; editing: boolean; multiline?: boolean; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-1" style={{ color: "#AEAEB2" }}>{label}</p>
      {editing ? (
        multiline ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-h-[64px] px-2 py-1.5 rounded-lg outline-none" style={{ border: "1px solid #EAEAEA", color: "#1D1D1F" }} />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded-lg outline-none" style={{ border: "1px solid #EAEAEA", color: "#1D1D1F" }} />
        )
      ) : (
        <p className="leading-snug whitespace-pre-wrap" style={{ color: "#444444" }}>{value || "—"}</p>
      )}
    </div>
  );
}

function NumberField({ label, value, editing, onChange }: { label: string; value: number; editing: boolean; onChange: (value: number) => void }) {
  return (
    <div>
      <p className="mb-1" style={{ color: "#AEAEB2" }}>{label}</p>
      {editing ? (
        <input type="number" min={1} max={10} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="w-full px-2 py-1.5 rounded-lg outline-none" style={{ border: "1px solid #EAEAEA", color: "#1D1D1F" }} />
      ) : (
        <p style={{ color: "#444444" }}>{value ? `${value}s` : "—"}</p>
      )}
    </div>
  );
}

function ShotFields({
  draft,
  editing,
  videoLanguage,
  assetLibrary,
  onChange,
  onSelect,
}: {
  seg: Step4SegmentItem;
  shot: Step4Shot;
  draft: ShotDraft;
  editing: boolean;
  videoLanguage?: string | null;
  assetLibrary: StepFourAssetLibraryVm;
  onChange: (patch: Partial<ShotDraft>) => void;
  onSelect: (kind: RefKind) => void;
}) {
  const languageOnce =
    videoLanguage === "en-US"
      ? "英语"
      : videoLanguage === "zh-CN"
        ? "中文"
        : "";
  const hasDialogue = !!normalizeDisplayText(draft.spokenText);
  const hasVoiceover = !!normalizeDisplayText(draft.voiceoverText);
  const hasSubtitle = !!normalizeDisplayText(draft.subtitleText);
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-3 space-y-3" style={{ background: "#fff", border: "1px solid #EAEAEA" }}>
        {!!languageOnce && <p className="text-[11px]" style={{ color: "#8E8E93" }}>语言：{languageOnce}</p>}
        <Field label="镜头作用" value={editing ? draft.shotRole : shotRoleLabel(draft.shotRole)} editing={editing} onChange={(v) => onChange({ shotRole: v })} />
        <Field label="观众要看懂什么" value={normalizeDisplayText(draft.viewerTakeaway)} editing={editing} multiline onChange={(v) => onChange({ viewerTakeaway: v })} />
        <Field label="画面导演" value={normalizeDisplayText(draft.visualDirection)} editing={editing} multiline onChange={(v) => onChange({ visualDirection: v, action: v })} />
        <Field label="角色动作" value={normalizeDisplayText(draft.characterDirection)} editing={editing} multiline onChange={(v) => onChange({ characterDirection: v, action: v })} />
        <Field label="商品出现方式" value={editing ? draft.productPresence : productPresenceLabel(draft.productPresence)} editing={editing} onChange={(v) => onChange({ productPresence: v })} />
        <Field label="商品出现目的" value={normalizeDisplayText(draft.productPurpose) || "未指定"} editing={editing} onChange={(v) => onChange({ productPurpose: v })} />
        <Field label="场景导演" value={normalizeDisplayText(draft.sceneDirection)} editing={editing} multiline onChange={(v) => onChange({ sceneDirection: v })} />
        <Field label="镜头导演" value={normalizeDisplayText(draft.cameraDirection)} editing={editing} multiline onChange={(v) => onChange({ cameraDirection: v })} />
        {(editing || hasDialogue) && (
          <Field label="角色口播" value={normalizeDisplayText(draft.spokenText)} editing={editing} multiline onChange={(v) => onChange({ spokenText: v })} />
        )}
        {(editing || hasVoiceover) && (
          <Field label="旁白" value={normalizeDisplayText(draft.voiceoverText)} editing={editing} multiline onChange={(v) => onChange({ voiceoverText: v })} />
        )}
        {(editing || hasSubtitle) && (
          <Field label="字幕" value={normalizeDisplayText(draft.subtitleText)} editing={editing} multiline onChange={(v) => onChange({ subtitleText: v })} />
        )}
        {!editing && !hasDialogue && !hasVoiceover && !hasSubtitle && (
          <p className="text-[11.5px]" style={{ color: "#6E6E73" }}>本镜头暂无台词/旁白。</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="声音意图" value={normalizeDisplayText(draft.emotion)} editing={editing} onChange={(v) => onChange({ emotion: v })} />
          <NumberField label="镜头时长" value={draft.durationSeconds} editing={editing} onChange={(v) => onChange({ durationSeconds: v })} />
        </div>
      </div>

      <div className="rounded-xl p-3 space-y-3" style={{ background: "#fff", border: "1px solid #EAEAEA" }}>
        <AssetRefRow
          title="出镜人物"
          emptyText="未选择人物"
          chips={resolveAssetChips(draft.characterRefs, assetLibrary, "characters")}
          disabled={!editing}
          onClick={() => onSelect("characters")}
        />
        <AssetRefRow
          title="场景"
          emptyText="未选择场景"
          chips={resolveAssetChips(draft.sceneRef ? [draft.sceneRef] : [], assetLibrary, "scene")}
          disabled={!editing}
          onClick={() => onSelect("scene")}
        />
        <AssetRefRow
          title="出镜产品"
          emptyText="未选择产品"
          chips={resolveAssetChips(draft.productRefs, assetLibrary, "products")}
          disabled={!editing}
          onClick={() => onSelect("products")}
        />
      </div>

    </div>
  );
}

function AssetRefRow({
  title,
  emptyText,
  chips,
  disabled,
  onClick,
}: {
  title: string;
  emptyText: string;
  chips: AssetChip[];
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold" style={{ color: "#6E6E73" }}>{title}</p>
        {!disabled && (
          <button type="button" onClick={onClick} className="text-[11px] px-2 py-1 rounded-md" style={{ background: "#F7F8FA", color: "#1D1D1F", border: "1px solid #EAEAEA" }}>
            更换
          </button>
        )}
      </div>
      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px]" style={{ background: "#F7F8FA", color: "#1D1D1F", border: "1px solid #EAEAEA" }}>
              {chip.img ? <img src={chip.img} alt={chip.name} className="w-4 h-4 rounded-full object-cover" /> : <span className="w-4 h-4 rounded-full bg-[#ECEDEF]" />}
              {chip.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px]" style={{ color: "#AEAEB2" }}>{emptyText}</p>
      )}
    </div>
  );
}

function AdvancedSettings({
  shot,
  draft,
  editing,
  onChange,
}: {
  shot: Step4Shot;
  draft: ShotDraft;
  editing: boolean;
  onChange: (patch: Partial<ShotDraft>) => void;
}) {
  const finalPrompt = draft.manualVideoPrompt || draft.videoPrompt;
  return (
    <details className="rounded-xl px-3 py-2" style={{ background: "#fff", border: "1px solid #EAEAEA" }}>
      <summary className="cursor-pointer text-[12px] font-semibold" style={{ color: "#1D1D1F" }}>高级设置</summary>
      <div className="mt-3 space-y-4 text-[11.5px] leading-snug" style={{ color: "#444444" }}>
        <section className="space-y-2">
          <div>
            <p className="text-[12px] font-semibold" style={{ color: "#1D1D1F" }}>AI 生成提示词</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#8E8E93" }}>
              这是系统最终用于生成视频的提示词。你可以手动修改它，保存后重新生成当前片段。
            </p>
          </div>
          {editing && (
            <>
              <Field label="AI 生成提示词" value={draft.videoPrompt} editing multiline onChange={(v) => onChange({ videoPrompt: v })} />
              <Field label="手动提示词" value={draft.manualVideoPrompt} editing multiline onChange={(v) => onChange({ manualVideoPrompt: v })} />
            </>
          )}
          <div>
            <p className="mb-1" style={{ color: "#AEAEB2" }}>最终提示词预览</p>
            <p className="whitespace-pre-wrap" style={{ color: "#444444" }}>{finalPrompt || "暂无提示词"}</p>
          </div>
          <p><span style={{ color: "#AEAEB2" }}>字符数 </span>{finalPrompt.length}</p>
        </section>

        <section className="space-y-2">
          <p className="text-[12px] font-semibold" style={{ color: "#1D1D1F" }}>生成约束</p>
          <p><span style={{ color: "#AEAEB2" }}>必须出现 </span>{draft.mustShowText || "—"}</p>
          <p><span style={{ color: "#AEAEB2" }}>避免出现 </span>{draft.mustAvoidText || "—"}</p>
          <p><span style={{ color: "#AEAEB2" }}>音频状态 </span>{audioStatusLabel(shot.audioStatus || "pending_tts_or_dubbing")}</p>
        </section>

        <details className="rounded-lg px-3 py-2" style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}>
          <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: "#6E6E73" }}>调试信息</summary>
          <div className="mt-2 space-y-2">
            <DebugRow label="卖点来源" value={shot.sourceSellingPoint || "—"} />
            <DebugRow label="视觉约束来源" value={shot.sourceVisualConstraints ? JSON.stringify(shot.sourceVisualConstraints) : "—"} />
            <DebugRow label="技术输入" value={shot.executionInput ? JSON.stringify(shot.executionInput) : "—"} />
            <DebugRow label="提示词长度信息" value={shot.promptBudget ? JSON.stringify(shot.promptBudget) : "—"} />
            <DebugRow label="生成接口信息" value={shot.providerError || (shot.providerResponse ? JSON.stringify(shot.providerResponse) : "—")} />
          </div>
        </details>
      </div>
    </details>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="break-words">
      <span style={{ color: "#AEAEB2" }}>{label} </span>
      {value}
    </p>
  );
}

function resolveAssetChips(values: string[], library: StepFourAssetLibraryVm, kind: RefKind): AssetChip[] {
  const source =
    kind === "characters"
      ? library.characters
      : kind === "scene"
        ? library.scenes
        : library.products;
  return values
    .map((raw) => {
      const value = String(raw || "").trim();
      if (!value) return null;
      const found = source.find((item) => String(item.id) === value || item.name === value);
      if (found) return { key: `${kind}-${value}`, name: found.name, img: found.img };
      if (/^\d+$/.test(value)) return null;
      return { key: `${kind}-${value}`, name: value, img: null };
    })
    .filter((x): x is AssetChip => Boolean(x));
}

function SegmentActions({
  seg,
  status,
  hasVideoUrl,
  progress,
  disabled,
  editing,
  dirty,
  saving,
  error,
  onEdit,
  onSave,
  onCancel,
  onGenerate,
}: {
  seg: Step4SegmentItem;
  status: "idle" | "queued" | "running" | "completed" | "failed";
  hasVideoUrl: boolean;
  progress: Step4RenderProgressMap[number] | null;
  disabled: boolean;
  editing: boolean;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onGenerate: () => void;
}) {
  const isGenerating = status === "queued" || status === "running";
  const hasFailed = status === "failed";
  const generateLabel = isGenerating ? "生成中..." : hasFailed ? "重试生成" : hasVideoUrl ? "重新生成" : "生成视频";

  if (isGenerating && !(editing || dirty)) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: "#F7F8FA", border: `1px solid ${seg.color}25` }}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <i className="ri-loader-4-line text-[13px] animate-spin" style={{ color: seg.color }} />
          <p className="text-[12px] font-semibold flex-1" style={{ color: "#1D1D1F" }}>{progress?.phaseLabel || "生成中..."}</p>
          {progress && <span className="text-[11px] font-mono" style={{ color: seg.color }}>{progress.percent}%</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <div className="text-[11px] px-3 py-2 rounded-lg" style={{ background: "rgba(220,38,38,0.06)", color: "#B91C1C", border: "1px solid rgba(220,38,38,0.2)" }}>{error}</div>}
      <div className="flex gap-2">
        {editing || dirty ? (
          <>
            <button type="button" onClick={onCancel} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px]" style={{ background: "#F7F8FA", color: saving ? "#AEAEB2" : "#444444", border: "1px solid #EAEAEA" }}>
              取消
            </button>
            <button type="button" onClick={onSave} disabled={disabled || saving} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold" style={{ background: disabled || saving ? "#EAEAEA" : "#1D1D1F", color: disabled || saving ? "#AEAEB2" : "#ffffff", cursor: disabled || saving ? "not-allowed" : "pointer" }}>
              <i className="ri-save-line text-[11px]" />{saving ? "保存中..." : "保存修改"}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit} disabled={disabled || saving} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px]" style={{ background: "#F7F8FA", color: disabled ? "#AEAEB2" : "#444444", border: "1px solid #EAEAEA", cursor: disabled ? "not-allowed" : "pointer" }}>
              <i className="ri-edit-line text-[11px]" />编辑片段
            </button>
            <button type="button" onClick={onGenerate} disabled={disabled || saving || isGenerating} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold" style={{ background: disabled || isGenerating ? "#EAEAEA" : "#1D1D1F", color: disabled || isGenerating ? "#AEAEB2" : "#ffffff", cursor: disabled || isGenerating ? "not-allowed" : "pointer" }}>
              <i className={`${isGenerating ? "ri-loader-4-line animate-spin" : hasVideoUrl || hasFailed ? "ri-refresh-line" : "ri-play-circle-line"} text-[11px]`} />{generateLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ReferenceSelector({ selector, library, draft, onClose, onSave }: { selector: { segId: number; shotId: number; kind: RefKind }; library: StepFourAssetLibraryVm; draft?: SegmentDraft; onClose: () => void; onSave: (values: SelectorSaveValue) => void }) {
  const current = draft?.shots[selector.shotId];
  const options: AssetOption[] =
    selector.kind === "characters"
      ? library.characters.map((x) => ({ id: String(x.id), name: x.name, subtitle: x.role, img: x.img }))
      : selector.kind === "scene"
        ? library.scenes.map((x) => ({ id: String(x.id), name: x.name, subtitle: x.type, img: x.img }))
        : library.products.map((x) => ({ id: String(x.id), name: x.name, subtitle: x.type, img: x.img }));
  const initial = selector.kind === "characters"
    ? cleanAssetIds(current?.characterAssetIds)
    : selector.kind === "scene"
      ? cleanAssetIds(current?.sceneAssetId ? [current.sceneAssetId] : [])
      : cleanAssetIds(current?.productAssetId ? [current.productAssetId] : []);
  const [selected, setSelected] = useState<string[]>(initial);
  const multi = selector.kind === "products";
  const title = selector.kind === "characters" ? "选择角色引用" : selector.kind === "scene" ? "选择场景引用" : "选择产品引用";

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.42)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #EAEAEA" }}>
          <h3 className="text-[16px] font-bold" style={{ color: "#1D1D1F" }}>{title}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg" style={{ color: "#6E6E73" }}><i className="ri-close-line text-[18px]" /></button>
        </div>
        <div className="p-4 max-h-[55vh] overflow-y-auto space-y-2">
          {options.map((opt) => {
            const active = selected.includes(opt.id);
            return (
              <button key={opt.id} type="button" onClick={() => setSelected((prev) => (multi ? (prev.includes(opt.id) ? prev.filter((x) => x !== opt.id) : [...prev, opt.id]) : [opt.id]))} className="w-full flex items-center gap-3 p-2 rounded-xl text-left" style={{ border: `1px solid ${active ? "#1D1D1F" : "#EAEAEA"}`, background: active ? "#F5F5F7" : "#fff" }}>
                {opt.img ? <img src={opt.img} alt={opt.name} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-[#ECEDEF]" />}
                <div className="flex-1">
                  <p className="text-[13px] font-semibold" style={{ color: "#1D1D1F" }}>{opt.name}</p>
                  <p className="text-[10px]" style={{ color: "#AEAEB2" }}>asset_id: {opt.id}</p>
                  <p className="text-[11px]" style={{ color: "#8E8E93" }}>{opt.subtitle}</p>
                </div>
                {active && <i className="ri-checkbox-circle-fill text-[16px]" style={{ color: "#047857" }} />}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid #EAEAEA" }}>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[12px]" style={{ background: "#F7F8FA", color: "#444444" }}>取消</button>
          <button
            type="button"
            onClick={() => {
              const selectedIds = cleanAssetIds(selected);
              const selectedRows = options.filter((opt) => selectedIds.includes(opt.id));
              onSave({
                refs: selectedRows.map((row) => row.name),
                assetIds: selectedIds,
              });
            }}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold"
            style={{ background: "#1D1D1F", color: "#fff" }}
          >
            保存引用
          </button>
        </div>
      </div>
    </div>
  );
}
