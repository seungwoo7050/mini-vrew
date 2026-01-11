import { useCallback, useEffect, useRef, useState } from 'react';

import type { Caption } from '@/data/types';
import type { ProgressData, CompletedData, ErrorData } from './ffmpegTypes';
import {
  initFFmpegWorker,
  isFFmpegReady,
  exportWithSubtitles,
  trimVideo,
  cancelCurrentJob,
} from './ffmpegClient';
import { adjustSrtForTrim, captionsToSrt } from './srtUtils';

export type ExportState = {
  status: 'idle' | 'initializing' | 'exporting' | 'completed' | 'error';
  progress: number;
  stage?: string;
  error?: string;
  outputBlob?: Blob;
  elapsedMs?: number;
};

export type ExportOptions = {
  videoBlob: Blob;
  trimRange?: { startMs: number; endMs: number } | null;
  captions?: Caption[];
  includeSubtitles?: boolean;
  videoFilter?: string;
  outputFormat?: 'mp4' | 'webm';
};

export type UseVideoExportReturn = {
  state: ExportState;
  isReady: boolean;
  startExport: (options: ExportOptions) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  downloadResult: (filename?: string) => void;
};

const initialState: ExportState = {
  status: 'idle',
  progress: 0,
};

export function useVideoExport(): UseVideoExportReturn {
  const [state, setState] = useState<ExportState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const alreadyReady = isFFmpegReady();

    queueMicrotask(() => {
      if (alreadyReady) {
        setIsReady(true);
        return;
      }

      setState((s) => ({ ...s, status: 'initializing' }));

      initFFmpegWorker()
        .then(() => {
          setIsReady(true);
          setState((s) =>
            s.status === 'initializing' ? { ...s, status: 'idle' } : s
          );
        })
        .catch((err) => {
          console.error('[useVideoExport] Init failed:', err);
          setState({
            status: 'error',
            progress: 0,
            error: 'FFmpeg 초기화 실패. 페이지를 새로고침하세요.',
          });
        });
    });

    return () => {
    };
  }, []);

  const handleProgress = useCallback((progress: ProgressData) => {
    setState((s) => ({
      ...s,
      progress: progress.progress,
      stage: progress.stage,
    }));
  }, []);

  const startExport = useCallback(
    async (options: ExportOptions) => {
      const {
        videoBlob,
        trimRange,
        captions = [],
        includeSubtitles = true,
        videoFilter,
        outputFormat = 'mp4',
      } = options;

      if (!isFFmpegReady()) {
        setState({
          status: 'error',
          progress: 0,
          error: 'FFmpeg가 준비되지 않았습니다.',
        });
        return;
      }

      setState({ status: 'exporting', progress: 0, stage: 'starting' });

      try {
        const startMs = trimRange?.startMs ?? 0;
        const endMs = trimRange?.endMs ?? 0;
        const hasTrim = trimRange && endMs > startMs;

        let result: CompletedData;

        if (includeSubtitles && captions.length > 0) {
          const srtContent = hasTrim
            ? adjustSrtForTrim(captions, startMs, endMs)
            : captionsToSrt(captions);

          result = await exportWithSubtitles(
            {
              inputBlob: videoBlob,
              startMs: hasTrim ? startMs : 0,
              endMs: hasTrim ? endMs : Infinity,
              srtContent,
              outputFormat,
              videoFilter,
            },
            { onProgress: handleProgress }
          );
        } else if (hasTrim) {
          result = await trimVideo(
            {
              inputBlob: videoBlob,
              startMs,
              endMs,
              outputFormat,
            },
            { onProgress: handleProgress }
          );
        } else {
          setState({
            status: 'completed',
            progress: 1,
            outputBlob: videoBlob,
            elapsedMs: 0,
          });
          return;
        }

        setState({
          status: 'completed',
          progress: 1,
          outputBlob: result.outputBlob,
          elapsedMs: result.elapsedMs,
        });
      } catch (err) {
        const error = err as ErrorData;
        setState({
          status: 'error',
          progress: 0,
          error: error.message || '내보내기 중 오류가 발생했습니다.',
        });
      }
    },
    [handleProgress]
  );

  const cancel = useCallback(() => {
    cancelCurrentJob();
    setState({
      status: 'idle',
      progress: 0,
    });
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const downloadResult = useCallback(
    (filename = 'export.mp4') => {
      if (!state.outputBlob) return;

      const url = URL.createObjectURL(state.outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [state.outputBlob]
  );

  return {
    state,
    isReady,
    startExport,
    cancel,
    reset,
    downloadResult,
  };
}