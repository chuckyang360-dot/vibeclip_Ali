import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { ShortDramaApiError, analyzeReferenceVideo, getReferenceVideo, uploadReferenceVideo } from '@/services/shortDramaApi';
import type { ReferenceVideoAnalysisJson, ReferenceVideoDto } from '@/types/shortDramaApi';
import { ri, sdColors, sdFontHeading } from './utils/shortDramaHelpers';

type SectionKey =
  | 'script_reading'
  | 'shooting_method'
  | 'actual_script_structure'
  | 'characters'
  | 'product_presentation'
  | 'shot_breakdown'
  | 'video_prompt';

const SECTIONS: { key: SectionKey; label: string; desc: string; icon: string }[] = [
  { key: 'script_reading', label: '剧本解读', desc: '这个视频在讲什么', icon: 'ri-file-text-line' },
  { key: 'shooting_method', label: '拍摄方法', desc: '视频是怎么拍的', icon: 'ri-camera-lens-line' },
  { key: 'actual_script_structure', label: '剧本结构', desc: '视频内容的叙事层次', icon: 'ri-node-tree' },
  { key: 'characters', label: '人物设定', desc: '人物身份、动作与情绪', icon: 'ri-user-voice-line' },
  { key: 'product_presentation', label: '产品呈现', desc: '产品出现和展示方式', icon: 'ri-box-3-line' },
  { key: 'shot_breakdown', label: '分镜拆解', desc: '逐镜头拆解拍摄要点', icon: 'ri-film-line' },
  { key: 'video_prompt', label: '分镜 PMT', desc: '逐段复刻生成提示词', icon: 'ri-sparkling-line' },
];

const SUPPORTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg', 'video/avi', 'video/x-flv', 'video/wmv', 'video/3gpp'];

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 MB';
  const mb = size / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds < 0) return '未知时长';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textify(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(textify).filter(Boolean).join('\n');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, v]) => {
        const body = textify(v);
        return body ? `${key}: ${body}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(value);
}

function firstText(data: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!data) return '';
  for (const key of keys) {
    const text = textify(data[key]).trim();
    if (text) return text;
  }
  return '';
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function visibleEntries(data: Record<string, unknown>, exclude: string[] = []): [string, unknown][] {
  const blocked = new Set(exclude);
  return Object.entries(data).filter(([key, value]) => {
    if (blocked.has(key)) return false;
    if (value == null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (isRecord(value) && Object.keys(value).length === 0) return false;
    return true;
  });
}

function labelFor(key: string): string {
  const labels: Record<string, string> = {
    summary: '内容概述',
    core_message: '核心表达',
    emotional_tone: '情绪氛围',
    audience_takeaway: '观众记忆点',
    overall_style: '整体拍法',
    camera: '镜头语言',
    lighting: '光线色彩',
    composition: '构图',
    editing: '剪辑',
    sound: '声音字幕',
    structure_type: '结构类型',
    is_marketing_structure: '是否营销结构',
    segments: '结构段落',
    time_range: '时间段',
    shot_id: '分镜编号',
    visual: '画面内容',
    action: '动作',
    purpose: '片段作用',
    recreate_notes: '复刻要点',
    recreate_prompt: '复刻 PMT',
    replaceable_parts: '可替换内容',
    role: '人物身份',
    appearance: '外观造型',
    emotion_and_action: '情绪动作',
    inference_notes: '判断依据',
    product: '产品',
    product_role: '产品角色',
    appearance_timing: '出现时机',
    presentation_method: '呈现方式',
    selling_points: '卖点信息',
    scene: '场景',
    character: '人物',
    shot_type: '景别',
    subtitle_or_audio: '字幕/声音',
    spoken_audio: '旁白/人声',
    subtitle_text: '字幕/屏幕文字',
    music_or_sound: '音乐/环境声',
    camera_movement: '运镜',
    visual_content: '画面内容',
    production_notes: '拍摄要点',
    replication_notes: '复刻建议',
    prompt: '生成 PMT',
    continuity_note: '衔接说明',
    video_recreation_overview: '复刻概览',
    what_to_recreate: '复刻重点',
    rhythm: '节奏',
    replacement_strategy: '替换策略',
    global_style_prompt: '全局风格',
    style_bible: '风格设定',
    global_negative_prompt: '全局负面词',
    assembly_notes: '合成说明',
    notes: '说明',
    full_prompt: '完整 Prompt',
    short_prompt: '精简 Prompt',
    negative_prompt: 'Negative Prompt',
    style_keywords: '风格关键词',
  };
  return labels[key] || key.replace(/_/g, ' ');
}

function displayTextify(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(displayTextify).filter(Boolean).join('\n');
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, v]) => {
        const body = displayTextify(v);
        return body ? `${labelFor(key)}：${body}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(value);
}

function cleanText(value: unknown): string {
  return displayTextify(value).trim();
}

function joinTextParts(parts: unknown[], separator = '\n'): string {
  return parts.map(cleanText).filter(Boolean).join(separator);
}

function productionPromptText(
  item: Record<string, unknown>,
  shot: Record<string, unknown> | null,
  globalStyle: Record<string, unknown> | null,
  index: number,
): string {
  const shotId = cleanText(item.shot_id || shot?.shot_id) || `S${String(index + 1).padStart(2, '0')}`;
  const timeRange = cleanText(item.time_range || shot?.time_range);
  const rawPrompt = firstText(item, ['prompt', 'recreate_prompt', 'full_prompt']);
  const lines = [
    `分镜：${shotId}${timeRange ? ` ${timeRange}` : ''}`,
    joinTextParts(['片段目标：', shot?.purpose], ''),
    rawPrompt ? `基础画面：${rawPrompt}` : '',
    joinTextParts(['场景：', shot?.scene], ''),
    joinTextParts(['人物：', shot?.character], ''),
    joinTextParts(['产品/替换对象：', shot?.product], ''),
    joinTextParts(['动作与情绪：', shot?.action], ''),
    joinTextParts(['镜头设计：', shot?.camera || shot?.camera_movement], ''),
    joinTextParts(['光线色彩：', shot?.lighting], ''),
    joinTextParts(['构图与画面质感：', joinTextParts([shot?.composition, shot?.visual || shot?.visual_content || shot?.content], '；')], ''),
    joinTextParts(['字幕/旁白/声音：', shot?.subtitle_or_audio], ''),
    joinTextParts(['可替换内容：', shot?.replaceable_parts], ''),
    joinTextParts(['衔接要求：', item.continuity_note], ''),
    joinTextParts(['负面词：', item.negative_prompt], ''),
    joinTextParts(['全局风格：', globalStyle?.style_bible || globalStyle?.overall_style], ''),
    '生成要求：按上述分镜复刻原片的镜头结构、节奏、光线、构图、声音和字幕关系；替换产品、人物或场景时，只替换指定对象，保留原片的叙事作用和视听风格。',
  ];
  return lines.filter((line) => line.trim()).join('\n');
}

function HighlightPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E5E5EA] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
      <div className="mb-2 text-[12px] font-black text-[#6E6E73]">{title}</div>
      <div className="text-[15px] leading-8 text-[#1D1D1F]">{children}</div>
    </div>
  );
}

function FactGrid({ items }: { items: { label: string; value: unknown }[] }) {
  const visible = items.map((item) => ({ ...item, text: displayTextify(item.value).trim() })).filter((item) => item.text);
  if (!visible.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visible.map((item) => (
        <div key={item.label} className="rounded-xl bg-[#F5F6F8] px-4 py-3">
          <div className="mb-1 text-[11px] font-black text-[#8E8E93]">{item.label}</div>
          <div className="whitespace-pre-wrap text-[13px] leading-6 text-[#2C2C2E]">{item.text}</div>
        </div>
      ))}
    </div>
  );
}

function DetailList({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (!value.length) return <p className="text-[13px] text-[#8E8E93]">暂无内容</p>;
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="rounded-lg bg-[#F5F6F8] px-4 py-3 text-[13px] leading-6 text-[#333333]">
            {isRecord(item) ? <DetailList value={item} /> : <p className="whitespace-pre-wrap">{textify(item)}</p>}
          </div>
        ))}
      </div>
    );
  }
  if (isRecord(value)) {
    return (
      <div className="space-y-3">
        {visibleEntries(value).map(([key, inner]) => (
          <div key={key}>
            <div className="mb-1 text-[12px] font-black text-[#6E6E73]">{labelFor(key)}</div>
            <DetailList value={inner} />
          </div>
        ))}
      </div>
    );
  }
  return <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#333333]">{textify(value) || '暂无内容'}</p>;
}

function TagList({ value }: { value: unknown }) {
  const tags = Array.isArray(value) ? value.map(textify).filter(Boolean) : textify(value).split(/[、,\n]/).map((x) => x.trim()).filter(Boolean);
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-[#EFEFF2] px-3 py-1.5 text-[12px] font-bold text-[#3A3A3C]">
          {tag}
        </span>
      ))}
    </div>
  );
}

function SectionFallbackView({ value }: { value: unknown }) {
  if (!value) return <p className="text-[13px] text-[#8E8E93]">该模块暂无解析内容。</p>;
  if (isRecord(value) && visibleEntries(value).length === 0) return null;
  return <DetailList value={value} />;
}

function ScriptReadingView({ value }: { value: unknown }) {
  if (!isRecord(value)) return <SectionFallbackView value={value} />;
  const summary = firstText(value, ['summary', 'content_summary', 'overview']);
  return (
    <div className="space-y-4">
      {summary && <HighlightPanel title="内容概述">{summary}</HighlightPanel>}
      <FactGrid
        items={[
          { label: '核心表达', value: value.core_message },
          { label: '情绪氛围', value: value.emotional_tone },
          { label: '观众记忆点', value: value.audience_takeaway },
          { label: '说明', value: value.notes },
        ]}
      />
      <SectionFallbackView value={Object.fromEntries(visibleEntries(value, ['summary', 'content_summary', 'overview', 'core_message', 'emotional_tone', 'audience_takeaway', 'notes']))} />
    </div>
  );
}

function ShootingMethodView({ value }: { value: unknown }) {
  if (!isRecord(value)) return <SectionFallbackView value={value} />;
  const style = firstText(value, ['overall_style', 'style', 'summary']);
  return (
    <div className="space-y-4">
      {style && <HighlightPanel title="整体拍法">{style}</HighlightPanel>}
      <TagList value={value.style_keywords || value.keywords} />
      <FactGrid
        items={[
          { label: '镜头语言', value: value.camera },
          { label: '光线色彩', value: value.lighting },
          { label: '构图', value: value.composition },
          { label: '剪辑', value: value.editing },
          { label: '声音字幕', value: value.sound },
        ]}
      />
      <SectionFallbackView value={Object.fromEntries(visibleEntries(value, ['overall_style', 'style', 'summary', 'style_keywords', 'keywords', 'camera', 'lighting', 'composition', 'editing', 'sound']))} />
    </div>
  );
}

function ScriptStructureView({ value }: { value: unknown }) {
  if (!isRecord(value)) return <SectionFallbackView value={value} />;
  const segments = asRecordArray(value.segments);
  return (
    <div className="space-y-4">
      <FactGrid items={[{ label: '结构类型', value: value.structure_type }, { label: '说明', value: value.notes }]} />
      {segments.length > 0 && (
        <div className="space-y-3">
          {segments.map((item, index) => (
            <div key={index} className="rounded-xl border border-[#E5E5EA] bg-white p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-full bg-[#1D1D1F] px-3 py-1 text-[11px] font-black text-white">{textify(item.time_range) || `段落 ${index + 1}`}</span>
                <span className="text-[13px] font-black text-[#1D1D1F]">{textify(item.role || item.function || item.title) || '结构段落'}</span>
              </div>
              <DetailList value={Object.fromEntries(visibleEntries(item, ['time_range', 'role', 'function', 'title']))} />
            </div>
          ))}
        </div>
      )}
      <SectionFallbackView value={Object.fromEntries(visibleEntries(value, ['structure_type', 'notes', 'segments']))} />
    </div>
  );
}

function CharactersView({ value }: { value: unknown }) {
  const rows = asRecordArray(value);
  if (!rows.length) return <SectionFallbackView value={value} />;
  return (
    <div className="space-y-3">
      {rows.map((item, index) => (
        <div key={index} className="rounded-xl border border-[#E5E5EA] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-black text-[#1D1D1F]">{textify(item.role || item.name) || `人物 ${index + 1}`}</h3>
            {textify(item.time_range) && <span className="rounded-full bg-[#F2F2F4] px-2.5 py-1 text-[11px] font-bold text-[#6E6E73]">{textify(item.time_range)}</span>}
          </div>
          <FactGrid
            items={[
              { label: '外观造型', value: item.appearance },
              { label: '情绪动作', value: item.emotion_and_action || item.action },
              { label: '判断依据', value: item.inference_notes || item.notes },
            ]}
          />
          <SectionFallbackView value={Object.fromEntries(visibleEntries(item, ['role', 'name', 'time_range', 'appearance', 'emotion_and_action', 'action', 'inference_notes', 'notes']))} />
        </div>
      ))}
    </div>
  );
}

function ProductPresentationView({ value }: { value: unknown }) {
  const rows = asRecordArray(value);
  if (!rows.length) return <SectionFallbackView value={value} />;
  return (
    <div className="space-y-3">
      {rows.map((item, index) => (
        <div key={index} className="rounded-xl border border-[#E5E5EA] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-black">{textify(item.product || item.name) || `产品露出 ${index + 1}`}</span>
            {textify(item.time_range) && <span className="rounded-full bg-[#F2F2F4] px-2.5 py-1 text-[11px] font-bold text-[#6E6E73]">{textify(item.time_range)}</span>}
          </div>
          <FactGrid
            items={[
              { label: '产品角色', value: item.product_role || item.role },
              { label: '出现时机', value: item.appearance_timing || item.timing },
              { label: '呈现方式', value: item.presentation_method || item.method },
              { label: '卖点信息', value: item.selling_points },
              { label: '场景关系', value: item.scene },
            ]}
          />
          <SectionFallbackView value={Object.fromEntries(visibleEntries(item, ['product', 'name', 'time_range', 'product_role', 'role', 'appearance_timing', 'timing', 'presentation_method', 'method', 'selling_points', 'scene']))} />
        </div>
      ))}
    </div>
  );
}

function ShotBreakdownView({ value }: { value: unknown }) {
  const rows = asRecordArray(value);
  if (!rows.length) return <SectionFallbackView value={value} />;
  return (
    <div className="space-y-3">
      {rows.map((item, index) => (
        <div key={index} className="rounded-xl border border-[#E5E5EA] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#1D1D1F] px-3 py-1 text-[11px] font-black text-white">{textify(item.time_range) || `镜头 ${index + 1}`}</span>
            <span className="text-[13px] font-black text-[#1D1D1F]">{textify(item.shot_type || item.scene || item.title) || '镜头拆解'}</span>
          </div>
          <FactGrid
            items={[
              { label: '画面内容', value: item.visual_content || item.visual || item.content },
              { label: '场景', value: item.scene },
              { label: '人物', value: item.character },
              { label: '产品', value: item.product },
              { label: '动作', value: item.action },
              { label: '景别', value: item.shot_type },
              { label: '运镜', value: item.camera_movement || item.camera },
              { label: '光线色彩', value: item.lighting },
              { label: '构图', value: item.composition },
              { label: '字幕/声音', value: item.subtitle_or_audio },
              { label: '片段作用', value: item.purpose },
              { label: '拍摄要点', value: item.production_notes || item.recreate_notes || item.notes },
              { label: '复刻建议', value: item.replication_notes },
            ]}
          />
          <SectionFallbackView value={Object.fromEntries(visibleEntries(item, ['shot_id', 'time_range', 'scene', 'title', 'visual_content', 'visual', 'content', 'character', 'product', 'action', 'shot_type', 'camera_movement', 'camera', 'lighting', 'composition', 'subtitle_or_audio', 'purpose', 'recreate_prompt', 'production_notes', 'recreate_notes', 'notes', 'replication_notes']))} />
        </div>
      ))}
    </div>
  );
}

function VideoPromptView({ value }: { value: unknown }) {
  if (!isRecord(value)) return <SectionFallbackView value={value} />;
  const shotRows = asRecordArray(value.shot_breakdown);
  const segmentPrompts = asRecordArray(value.segment_prompts);
  const promptRows = segmentPrompts.length > 0 ? segmentPrompts : shotRows;
  const shotById = new Map(shotRows.map((shot, index) => [textify(shot.shot_id) || `S${String(index + 1).padStart(2, '0')}`, shot]));
  const globalStyle = isRecord(value.global_style_prompt) ? value.global_style_prompt : null;
  const legacyPrompt = isRecord(value.video_prompt) ? value.video_prompt : value;
  const full = firstText(legacyPrompt, ['full_prompt', 'prompt', 'video_prompt']);
  return (
    <div className="space-y-4">
      {promptRows.length > 0 && (
        <div className="space-y-3">
          {promptRows.map((item, index) => {
            const shotId = textify(item.shot_id) || `S${String(index + 1).padStart(2, '0')}`;
            const shot = shotById.get(shotId) || shotRows[index] || null;
            const promptText = productionPromptText(item, shot, globalStyle, index);
            return (
              <div key={`${shotId}-${index}`} className="rounded-xl border border-[#E5E5EA] bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#1D1D1F] px-3 py-1 text-[11px] font-black text-white">{textify(item.time_range) || `分镜 ${index + 1}`}</span>
                    <span className="text-[13px] font-black text-[#1D1D1F]">{shotId}</span>
                  </div>
                  {promptText && (
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(promptText)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E1E1E6] bg-white px-3 text-[11px] font-bold text-[#333333]"
                    >
                      <i className={ri('ri-file-copy-line', 'text-[13px]')} aria-hidden />
                      复制本段
                    </button>
                  )}
                </div>
                {promptText && (
                  <div className="rounded-xl bg-[#1D1D1F] p-4 text-white">
                    <div className="mb-2 text-[11px] font-black text-white/58">生产级单段 PMT</div>
                    <p className="whitespace-pre-wrap text-[13px] leading-7 text-white/88">{promptText}</p>
                  </div>
                )}
                <div className="mt-3">
                  <FactGrid
                    items={[
                      { label: '对应场景', value: shot?.scene },
                      { label: '人物/产品', value: [shot?.character, shot?.product].filter(Boolean).join(' / ') },
                      { label: '动作', value: shot?.action },
                      { label: '镜头/运镜', value: shot?.camera || shot?.camera_movement },
                      { label: '光线构图', value: [shot?.lighting, shot?.composition].filter(Boolean).join('\n') },
                      { label: '字幕/声音', value: shot?.subtitle_or_audio },
                      { label: '负面词', value: item.negative_prompt },
                      { label: '衔接说明', value: item.continuity_note },
                    ]}
                  />
                </div>
                <SectionFallbackView value={Object.fromEntries(visibleEntries(item, ['shot_id', 'time_range', 'prompt', 'recreate_prompt', 'full_prompt', 'negative_prompt', 'continuity_note']))} />
              </div>
            );
          })}
        </div>
      )}
      {globalStyle && (
        <HighlightPanel title="全局风格设定">
          <DetailList value={globalStyle} />
        </HighlightPanel>
      )}
      {!promptRows.length && full && (
        <div className="rounded-xl bg-[#1D1D1F] p-5 text-white">
          <div className="mb-3 text-[12px] font-black text-white/58">完整提示词</div>
          <p className="whitespace-pre-wrap text-[13px] leading-7 text-white/88">{full}</p>
        </div>
      )}
      {!promptRows.length && (
        <FactGrid
          items={[
            { label: '精简 Prompt', value: legacyPrompt.short_prompt },
            { label: 'Negative Prompt', value: legacyPrompt.negative_prompt },
            { label: '风格关键词', value: legacyPrompt.style_keywords },
          ]}
        />
      )}
      <SectionFallbackView value={Object.fromEntries(visibleEntries(value, ['segment_prompts', 'shot_breakdown', 'global_style_prompt', 'video_prompt', 'full_prompt', 'prompt', 'short_prompt', 'negative_prompt', 'style_keywords']))} />
    </div>
  );
}

function AnalysisSectionView({ section, value }: { section: SectionKey; value: unknown }) {
  if (section === 'script_reading') return <ScriptReadingView value={value} />;
  if (section === 'shooting_method') return <ShootingMethodView value={value} />;
  if (section === 'actual_script_structure') return <ScriptStructureView value={value} />;
  if (section === 'characters') return <CharactersView value={value} />;
  if (section === 'product_presentation') return <ProductPresentationView value={value} />;
  if (section === 'shot_breakdown') return <ShotBreakdownView value={value} />;
  if (section === 'video_prompt') return <VideoPromptView value={value} />;
  return <SectionFallbackView value={value} />;
}

function sectionValue(analysis: ReferenceVideoAnalysisJson | null | undefined, key: SectionKey): unknown {
  if (!analysis) return null;
  if (key === 'video_prompt') {
    if (Array.isArray(analysis.segment_prompts) || isRecord(analysis.global_style_prompt)) {
      return {
        segment_prompts: analysis.segment_prompts,
        shot_breakdown: analysis.shot_breakdown,
        global_style_prompt: analysis.global_style_prompt,
        video_prompt: analysis.video_prompt,
      };
    }
  }
  return analysis[key];
}

function videoPromptCopyText(value: unknown): string {
  if (!isRecord(value)) return textify(value);
  const shotRows = asRecordArray(value.shot_breakdown);
  const segmentPrompts = asRecordArray(value.segment_prompts);
  const promptRows = segmentPrompts.length > 0 ? segmentPrompts : shotRows;
  const shotById = new Map(shotRows.map((shot, index) => [textify(shot.shot_id) || `S${String(index + 1).padStart(2, '0')}`, shot]));
  const globalStyle = isRecord(value.global_style_prompt) ? value.global_style_prompt : null;
  if (!promptRows.length) return textify(value);
  const promptText = promptRows
    .map((item, index) => {
      const shotId = textify(item.shot_id) || `S${String(index + 1).padStart(2, '0')}`;
      const shot = shotById.get(shotId) || shotRows[index] || null;
      return productionPromptText(item, shot, globalStyle, index);
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
  const globalText = globalStyle ? `\n\n# 全局风格\n${displayTextify(globalStyle)}` : '';
  return `${promptText}${globalText}`;
}

function sectionCopyText(analysis: ReferenceVideoAnalysisJson | null | undefined, key: SectionKey): string {
  const section = SECTIONS.find((x) => x.key === key);
  const value = sectionValue(analysis, key);
  const body = key === 'video_prompt' ? videoPromptCopyText(value) : textify(value);
  return [`# ${section?.label || key}`, body].filter(Boolean).join('\n\n');
}

export function ShortDramaVideoAnalysisPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [video, setVideo] = useState<ReferenceVideoDto | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>('');
  const [active, setActive] = useState<SectionKey>('script_reading');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rawId = Number(searchParams.get('video_id') || 0);
    if (!rawId) return;
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        const existing = await getReferenceVideo(rawId);
        if (cancelled) return;
        setVideo(existing);
      } catch (e) {
        if (!cancelled) setError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '加载视频解析失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [active]);

  const analysis = video?.analysis_json || null;
  const canAnalyze = video != null && !uploading && !analyzing;
  const currentValue = sectionValue(analysis, active);
  const currentSection = SECTIONS.find((s) => s.key === active) || SECTIONS[0];
  const statusText = uploading
    ? '上传中'
    : analyzing || video?.analysis_status === 'processing'
      ? '解析中'
      : video?.analysis_status === 'success'
        ? '解析完成'
        : video?.analysis_status === 'failed'
          ? '解析失败'
          : video
            ? '待解析'
            : '等待上传';

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setError('暂不支持该视频格式，请上传 MP4、MOV、WebM 等常见视频格式。');
      return;
    }
    setUploading(true);
    setAnalyzing(false);
    setError(null);
    setVideo(null);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const preview = URL.createObjectURL(file);
    setLocalPreviewUrl(preview);
    try {
      const uploaded = await uploadReferenceVideo(file, user?.id ?? null);
      setVideo(uploaded);
      setUploading(false);
      setAnalyzing(true);
      const analyzed = await analyzeReferenceVideo(uploaded.id);
      setVideo(analyzed.video);
    } catch (e) {
      setError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '视频上传或解析失败');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const copyCurrent = async () => {
    const text = sectionCopyText(analysis, active);
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopied(active);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const copyAll = async () => {
    const text = SECTIONS.map((s) => sectionCopyText(analysis, s.key)).join('\n\n');
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopied('all');
    window.setTimeout(() => setCopied(null), 1400);
  };

  const meta = useMemo(() => {
    if (!video) return [];
    return [
      video.original_filename,
      formatBytes(video.file_size),
      formatDuration(video.duration_seconds),
      statusText,
    ].filter(Boolean);
  }, [video, statusText]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1D1D1F]">
      <Navbar />
      <main className="mx-auto flex h-screen max-w-[1440px] flex-col px-5 pb-5 pt-20 lg:px-8">
        <div className="mb-4 shrink-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Link to="/" className="mb-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#6E6E73]">
              <i className={ri('ri-arrow-left-line', 'text-[14px]')} aria-hidden />
              返回首页
            </Link>
            <h1 style={sdFontHeading} className="text-[28px] font-black leading-tight md:text-[40px]">
              视频解构
            </h1>
            <p className="mt-2 text-[13px] text-[#6E6E73]">
              上传参考视频，拆出它真实的剧本结构、拍摄方法、人物、产品露出、分镜和分镜 PMT。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1D1D1F] px-4 text-[13px] font-bold text-white"
            >
              <i className={ri('ri-upload-cloud-2-line', 'text-[15px]')} aria-hidden />
              上传视频
            </button>
            {analysis && (
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E1E1E6] bg-white px-4 text-[13px] font-bold text-[#333333]"
              >
                <i className={ri('ri-file-copy-line', 'text-[15px]')} aria-hidden />
                {copied === 'all' ? '已复制' : '复制全部'}
              </button>
            )}
          </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/mpeg,video/avi,video/x-flv,video/wmv,video/3gpp"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(420px,0.92fr)_minmax(560px,1.08fr)]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#E5E5EA] bg-[#111111]">
            <div className="flex h-11 items-center justify-between border-b border-white/10 px-4 text-white">
              <div className="flex items-center gap-2 text-[13px] font-bold">
                <i className={ri('ri-video-line', 'text-[16px]')} aria-hidden />
                视频内容
              </div>
              <span className="text-[12px] text-white/58">{statusText}</span>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
              {localPreviewUrl || video?.public_url ? (
                <video src={localPreviewUrl || video?.public_url} controls className="h-full w-full object-contain" />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mx-6 flex max-w-sm flex-col items-center rounded-xl border border-dashed border-white/18 bg-white/[0.06] px-8 py-10 text-center text-white"
                >
                  <i className={ri('ri-upload-cloud-2-line', 'mb-4 text-[34px] text-white/76')} aria-hidden />
                  <span className="text-[17px] font-black">上传一个参考视频</span>
                  <span className="mt-2 text-[12px] leading-relaxed text-white/56">支持 MP4、MOV、WebM 等常见视频格式。</span>
                </button>
              )}
              {(uploading || analyzing) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/68 text-white backdrop-blur-sm">
                  <i className={ri('ri-loader-4-line', 'animate-spin text-[28px]')} aria-hidden />
                  <p className="mt-3 text-[13px] font-semibold">{uploading ? '正在上传视频…' : '正在解析视频…'}</p>
                </div>
              )}
            </div>
            {meta.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
                {meta.map((item) => (
                  <span key={item} className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/58">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="grid min-h-0 overflow-hidden rounded-xl border border-[#E5E5EA] bg-white lg:grid-cols-[196px_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-y-auto border-b border-[#EAEAEA] bg-[#FAFAFA] p-3 lg:border-b-0 lg:border-r">
              <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">解析内容</div>
              <div className="space-y-1.5">
                {SECTIONS.map((item) => {
                  const selected = item.key === active;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActive(item.key)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors"
                      style={{ background: selected ? '#1D1D1F' : 'transparent', color: selected ? '#ffffff' : '#444444' }}
                    >
                      <i className={ri(item.icon, 'shrink-0 text-[17px]')} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-black">{item.label}</span>
                        <span className="mt-0.5 block truncate text-[11px]" style={{ color: selected ? 'rgba(255,255,255,0.58)' : '#8E8E93' }}>
                          {item.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="flex min-h-0 flex-col">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#EAEAEA] bg-white px-5">
                <div>
                  <h2 className="text-[16px] font-black" style={sdFontHeading}>
                    {currentSection.label}
                  </h2>
                  <p className="text-[11px] text-[#8E8E93]">{currentSection.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={copyCurrent}
                  disabled={!analysis}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E1E1E6] bg-white px-3 text-[12px] font-bold text-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className={ri('ri-file-copy-line', 'text-[14px]')} aria-hidden />
                  {copied === active ? '已复制' : '复制'}
                </button>
              </div>
              <div ref={contentScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[#F7F8FA] p-5">
                {uploading ? (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                    <i className={ri('ri-loader-4-line', 'animate-spin text-[28px] text-[#1D1D1F]')} aria-hidden />
                    <p className="mt-4 text-[14px] font-bold">正在上传视频</p>
                    <p className="mt-2 text-[12px] text-[#8E8E93]">上传完成后会自动开始解析。</p>
                  </div>
                ) : !video ? (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#F5F5F7]" style={{ color: sdColors.ink }}>
                      <i className={ri('ri-movie-2-line', 'text-[26px]')} aria-hidden />
                    </div>
                    <p className="mt-4 text-[15px] font-black">先上传视频</p>
                    <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[#8E8E93]">
                      上传完成后，将在这里展示视频的结构化拆解结果。
                    </p>
                  </div>
                ) : analyzing || video.analysis_status === 'processing' ? (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                    <i className={ri('ri-loader-4-line', 'animate-spin text-[28px] text-[#1D1D1F]')} aria-hidden />
                    <p className="mt-4 text-[14px] font-bold">正在解析这个视频</p>
                    <p className="mt-2 text-[12px] text-[#8E8E93]">请稍候，解析结果很快就会展示在这里。</p>
                  </div>
                ) : analysis ? (
                  currentValue ? <AnalysisSectionView section={active} value={currentValue} /> : <p className="text-[13px] text-[#8E8E93]">该模块暂无解析内容。</p>
                ) : (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                    <p className="text-[14px] font-bold">{video.analysis_status === 'failed' ? '解析失败' : '等待解析'}</p>
                    <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[#8E8E93]">
                      {video.error_message || '点击重新解析后会再次尝试解析该视频。'}
                    </p>
                    <button
                      type="button"
                      disabled={!canAnalyze}
                      onClick={async () => {
                        if (!video) return;
                        setAnalyzing(true);
                        setError(null);
                        try {
                          const analyzed = await analyzeReferenceVideo(video.id);
                          setVideo(analyzed.video);
                        } catch (e) {
                          setError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '视频解析失败');
                        } finally {
                          setAnalyzing(false);
                        }
                      }}
                      className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#1D1D1F] px-4 text-[13px] font-bold text-white disabled:opacity-50"
                    >
                      <i className={ri('ri-refresh-line', 'text-[15px]')} aria-hidden />
                      重新解析
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
