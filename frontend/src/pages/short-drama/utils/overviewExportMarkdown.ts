import type { PipelineSummaryDto, SegmentPlanItemDto, StoryBlueprintDto } from '@/types/shortDramaApi';
import { segmentScriptDtoToStepSegmentViewModel } from './stepFourAdapters';

export function safeProjectExportBaseName(projectName: string | undefined | null): string {
  const s = (projectName ?? '')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return s || 'project';
}

function segmentPlanForIndex(
  blueprint: StoryBlueprintDto | null | undefined,
  segmentId: string,
  index: number,
): SegmentPlanItemDto | undefined {
  const plan = blueprint?.segment_plan;
  if (!Array.isArray(plan) || plan.length === 0) return undefined;
  const byId = plan.find((p) => (p.segment_id ?? '').trim() === segmentId.trim());
  if (byId) return byId;
  return plan[index];
}

function formatProductExposure(plan: SegmentPlanItemDto | undefined): string | undefined {
  if (!plan) return undefined;
  const m = toMarkdownText(plan.product_exposure_mode);
  if (m) return m;
  const s = toMarkdownText(plan.summary);
  if (s) return s;
  return undefined;
}

const toMarkdownText = (value: string | string[] | undefined | null): string => {
  if (Array.isArray(value)) return value.filter(Boolean).join('、');
  return typeof value === 'string' ? value.trim() : '';
};

/** 无数据时返回 null，由调用方提示「数据不完整」 */
export function buildOverviewScriptMarkdown(pipeline: PipelineSummaryDto | null): string | null {
  if (!pipeline?.project) return null;
  const rows = pipeline.segment_scripts;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const name = safeProjectExportBaseName(pipeline.project.project_name);
  const p = pipeline.project;
  const bp = pipeline.story_blueprint?.blueprint ?? null;

  const lines: string[] = [];
  lines.push(`# ${name} — 脚本`);
  lines.push('');
  lines.push('## 项目信息');
  lines.push(`- **项目名**：${name}`);
  lines.push(`- **格式**：${p.format?.trim() || '—'}`);
  lines.push(`- **风格**：${toMarkdownText(p.style) || '—'}`);
  lines.push(`- **视听风格**：${p.visual_style?.trim() || '—'}`);
  lines.push(`- **比例**：${p.aspect_ratio?.trim() || '—'}`);
  lines.push(`- **时长**：${p.duration?.trim() || '—'}`);
  lines.push('');

  const sorted = [...rows].sort((a, b) => {
    const na = parseInt(String(a.segment_id).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b.segment_id).replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  sorted.forEach((row, idx) => {
    const vm = segmentScriptDtoToStepSegmentViewModel(row, idx);
    const plan = segmentPlanForIndex(bp, row.segment_id, idx);
    const label = `S${idx + 1}`;
    lines.push(`## ${label} — ${vm.name}`);
    lines.push(`- **标题**：${vm.name}`);
    lines.push(`- **时长**：${vm.duration}`);
    lines.push(`- **情绪 / 目标**：${vm.goal}`);
    const exposure = formatProductExposure(plan);
    if (exposure) lines.push(`- **产品露出**：${exposure}`);
    lines.push('');

    vm.shots.forEach((shot) => {
      lines.push(`### ${label} · Shot ${shot.id}`);
      lines.push(`- **镜头描述**：${shot.desc}`);
      if (shot.sceneDescription) lines.push(`- **场景**：${shot.sceneDescription}`);
      if (shot.subjectDescription) lines.push(`- **角色 / 主体**：${shot.subjectDescription}`);
      if (shot.action) lines.push(`- **动作**：${shot.action}`);
      lines.push(`- **角色口播**：${shot.spokenText || '无角色口播'}`);
      lines.push(`- **旁白/画外音**：${shot.voiceoverText || '无旁白'}`);
      lines.push(`- **字幕文案**：${shot.subtitleText || '无字幕'}`);
      lines.push(`- **情绪**：${shot.emotion || '—'}`);
      lines.push(`- **时长**：${shot.duration}`);
      if (shot.cameraDescription) lines.push(`- **镜头运动**：${shot.cameraDescription}`);
      if (shot.imagePrompt) lines.push(`- **出图提示**：${shot.imagePrompt}`);
      if (shot.videoPrompt) lines.push(`- **视频提示**：${shot.videoPrompt}`);
      lines.push('');
    });
  });

  return lines.join('\n').trim() + '\n';
}

export function buildOverviewStoryboardMarkdown(pipeline: PipelineSummaryDto | null): string | null {
  if (!pipeline?.project) return null;
  const rows = pipeline.segment_scripts;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const name = safeProjectExportBaseName(pipeline.project.project_name);
  const bp = pipeline.story_blueprint?.blueprint ?? null;

  const lines: string[] = [];
  lines.push(`# ${name} — 分镜`);
  lines.push('');

  const sorted = [...rows].sort((a, b) => {
    const na = parseInt(String(a.segment_id).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b.segment_id).replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  sorted.forEach((row, idx) => {
    const vm = segmentScriptDtoToStepSegmentViewModel(row, idx);
    const plan = segmentPlanForIndex(bp, row.segment_id, idx);
    const label = `S${idx + 1}`;
    lines.push(`## Segment ${label} — ${vm.name}`);
    lines.push('');

    vm.shots.forEach((shot) => {
      lines.push(`### Shot ${shot.id}`);
      lines.push(`- **镜头描述**：${shot.desc}`);
      if (shot.sceneDescription) lines.push(`- **场景**：${shot.sceneDescription}`);
      if (shot.subjectDescription) lines.push(`- **角色**：${shot.subjectDescription}`);
      const exposure = formatProductExposure(plan);
      if (exposure) lines.push(`- **产品露出**：${exposure}`);
      lines.push(`- **时长**：${shot.duration}`);
      lines.push(`- **情绪**：${shot.emotion || '—'}`);
      lines.push('');
    });
  });

  return lines.join('\n').trim() + '\n';
}
