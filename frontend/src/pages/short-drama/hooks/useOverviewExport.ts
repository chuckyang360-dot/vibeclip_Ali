import { useCallback, useState } from 'react';
import { fetchShortDramaExportZip, ShortDramaApiError } from '@/services/shortDramaApi';
import type { PipelineSummaryDto } from '@/types/shortDramaApi';
import {
  buildOverviewScriptMarkdown,
  buildOverviewStoryboardMarkdown,
  safeProjectExportBaseName,
} from '../utils/overviewExportMarkdown';
import { buildMediaFetchUrl, downloadUrlAsFile, triggerBlobDownload } from '../utils/overviewExportDownload';
import { resolveFinalVideoUrlFromPipeline } from '../utils/overviewAdapters';

export type OverviewExportBusyKey = 'all' | 'video' | 'video_pack' | 'script' | 'storyboard' | null;

function canExportVideoZip(pipeline: PipelineSummaryDto | null): boolean {
  if (!pipeline) return false;
  const finalOk = !!(pipeline.has_final_video && resolveFinalVideoUrlFromPipeline(pipeline));
  return !!(pipeline.has_all_segment_videos && finalOk);
}

function canExportDocs(pipeline: PipelineSummaryDto | null): boolean {
  return Array.isArray(pipeline?.segment_scripts) && (pipeline!.segment_scripts!.length ?? 0) > 0;
}

export function useOverviewExport(
  projectId: number | null,
  pipeline: PipelineSummaryDto | null,
  projectDisplayName: string,
) {
  const [busy, setBusy] = useState<OverviewExportBusyKey>(null);

  const downloadFinalVideo = useCallback(async () => {
    const url = resolveFinalVideoUrlFromPipeline(pipeline);
    if (!url) {
      console.info('FRONT_OVERVIEW_DOWNLOAD_FINAL_VIDEO_BLOCKED');
      window.alert('完整视频尚未生成');
      return;
    }
    const base = safeProjectExportBaseName(projectDisplayName);
    setBusy('video');
    try {
      await downloadUrlAsFile(buildMediaFetchUrl(url), `${base}-final.mp4`);
      console.info('FRONT_OVERVIEW_DOWNLOAD_FINAL_VIDEO');
    } catch {
      window.alert('下载失败，请检查网络后重试');
    } finally {
      setBusy(null);
    }
  }, [pipeline, projectDisplayName]);

  const exportScript = useCallback(async () => {
    console.info('FRONT_OVERVIEW_EXPORT_SCRIPT_START');
    if (!canExportDocs(pipeline)) {
      window.alert('当前项目数据不完整，暂不可导出');
      console.info('FRONT_OVERVIEW_EXPORT_SCRIPT_FAILED');
      return;
    }
    setBusy('script');
    try {
      const md = buildOverviewScriptMarkdown(pipeline);
      if (!md) {
        window.alert('当前项目数据不完整，暂不可导出');
        console.info('FRONT_OVERVIEW_EXPORT_SCRIPT_FAILED');
        return;
      }
      const base = safeProjectExportBaseName(projectDisplayName);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      triggerBlobDownload(blob, `${base}-script.md`);
      console.info('FRONT_OVERVIEW_EXPORT_SCRIPT_SUCCESS');
    } catch {
      window.alert('导出失败，请稍后重试');
      console.info('FRONT_OVERVIEW_EXPORT_SCRIPT_FAILED');
    } finally {
      setBusy(null);
    }
  }, [pipeline, projectDisplayName]);

  const exportStoryboard = useCallback(async () => {
    console.info('FRONT_OVERVIEW_EXPORT_STORYBOARD_START');
    if (!canExportDocs(pipeline)) {
      window.alert('当前项目数据不完整，暂不可导出');
      console.info('FRONT_OVERVIEW_EXPORT_STORYBOARD_FAILED');
      return;
    }
    setBusy('storyboard');
    try {
      const md = buildOverviewStoryboardMarkdown(pipeline);
      if (!md) {
        window.alert('当前项目数据不完整，暂不可导出');
        console.info('FRONT_OVERVIEW_EXPORT_STORYBOARD_FAILED');
        return;
      }
      const base = safeProjectExportBaseName(projectDisplayName);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      triggerBlobDownload(blob, `${base}-storyboard.md`);
      console.info('FRONT_OVERVIEW_EXPORT_STORYBOARD_SUCCESS');
    } catch {
      window.alert('导出失败，请稍后重试');
      console.info('FRONT_OVERVIEW_EXPORT_STORYBOARD_FAILED');
    } finally {
      setBusy(null);
    }
  }, [pipeline, projectDisplayName]);

  const exportVideoPack = useCallback(async () => {
    console.info('FRONT_OVERVIEW_EXPORT_VIDEO_PACK_START');
    if (projectId == null) return;
    if (!canExportVideoZip(pipeline)) {
      window.alert('仍有片段未生成，暂不可导出视频包');
      console.info('FRONT_OVERVIEW_EXPORT_VIDEO_PACK_FAILED');
      return;
    }
    setBusy('video_pack');
    try {
      const blob = await fetchShortDramaExportZip(projectId, 'videos');
      const base = safeProjectExportBaseName(projectDisplayName);
      triggerBlobDownload(blob, `${base}-videos.zip`);
      console.info('FRONT_OVERVIEW_EXPORT_VIDEO_PACK_SUCCESS');
    } catch (e) {
      console.info('FRONT_OVERVIEW_EXPORT_VIDEO_PACK_FAILED');
      const msg =
        e instanceof ShortDramaApiError
          ? e.message.includes('仍有片段') || e.message.includes('片段')
            ? '仍有片段未生成，暂不可导出视频包'
            : e.status >= 500
              ? '导出失败，请稍后重试'
              : e.message || '导出失败，请稍后重试'
          : '导出失败，请稍后重试';
      window.alert(msg);
    } finally {
      setBusy(null);
    }
  }, [pipeline, projectId, projectDisplayName]);

  const exportAll = useCallback(async () => {
    console.info('FRONT_OVERVIEW_EXPORT_ALL_START');
    if (projectId == null) return;
    if (!canExportVideoZip(pipeline)) {
      window.alert('当前视频尚未全部生成，暂不可一键导出');
      console.info('FRONT_OVERVIEW_EXPORT_ALL_FAILED');
      return;
    }
    setBusy('all');
    try {
      const blob = await fetchShortDramaExportZip(projectId, 'all');
      const base = safeProjectExportBaseName(projectDisplayName);
      triggerBlobDownload(blob, `${base}-export.zip`);
      console.info('FRONT_OVERVIEW_EXPORT_ALL_SUCCESS');
    } catch (e) {
      console.info('FRONT_OVERVIEW_EXPORT_ALL_FAILED');
      const msg =
        e instanceof ShortDramaApiError
          ? e.message.includes('尚未全部') || e.message.includes('全部生成')
            ? '当前视频尚未全部生成，暂不可一键导出'
            : e.status >= 500
              ? '导出失败，请稍后重试'
              : e.message || '导出失败，请稍后重试'
          : '导出失败，请稍后重试';
      window.alert(msg);
    } finally {
      setBusy(null);
    }
  }, [pipeline, projectId, projectDisplayName]);

  return {
    busy,
    downloadFinalVideo,
    exportScript,
    exportStoryboard,
    exportVideoPack,
    exportAll,
  };
}
