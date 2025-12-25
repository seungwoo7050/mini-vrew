import { useCallback, useEffect, useRef, useState } from 'react';

import {
  computePeaksInIdle,
  type WaveformPeaks,
  type ComputePeaksOptions,
} from '@/lib/waveformPeaks';

type WaveformState = {
  peaks: WaveformPeaks | null;
  pyramid: WaveformPeaks[] | null;
  isLoading: boolean;
  error: string | null;
  progress: number;
};

type UseWaveformPeaksArgs = {
  videoBlob: Blob | null;
  bucketCount?: number;
  options?: ComputePeaksOptions;
};

export function useWaveformPeaks({
  videoBlob,
  bucketCount = 800,
  options,
}: UseWaveformPeaksArgs) {
  const [state, setState] = useState<WaveformState>({
    peaks: null,
    pyramid: null,
    isLoading: false,
    error: null,
    progress: 0,
  });

  const abortRef = useRef<AbortController | null>(null);

  const extractPeaks = useCallback(async () => {
    if (!videoBlob) {
      setState({
        peaks: null,
        pyramid: null,
        isLoading: false,
        error: null,
        progress: 0,
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      peaks: null,
      pyramid: null,
      isLoading: true,
      error: null,
      progress: 0,
    });

    try {
      const arrayBuffer = await videoBlob.arrayBuffer();
      if (controller.signal.aborted) return;

      const audioContext = new AudioContext();
      let audioBuffer: AudioBuffer;

      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch {
        await audioContext.close();
        if (controller.signal.aborted) return;
        setState({
          peaks: null,
          pyramid: null,
          isLoading: false,
          error: '오디오를 디코딩할 수 없습니다.',
          progress: 0,
        });
        return;
      }

      if (controller.signal.aborted) {
        await audioContext.close();
        return;
      }

      setState((prev) => ({ ...prev, progress: 0.3 }));

      const numChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const samples = new Float32Array(length);

      if (numChannels === 1) {
        samples.set(audioBuffer.getChannelData(0));
      } else {
        for (let ch = 0; ch < numChannels; ch++) {
          const channelData = audioBuffer.getChannelData(ch);
          for (let i = 0; i < length; i++) {
            samples[i] += channelData[i] / numChannels;
          }
        }
      }

      await audioContext.close();

      if (controller.signal.aborted) return;

      setState((prev) => ({ ...prev, progress: 0.5 }));

      const peaksRes = await computePeaksInIdle(
        samples,
        bucketCount,
        controller.signal,
        options
      );

      if (controller.signal.aborted) return;

      const finalPeaks: WaveformPeaks =
        'peaks' in peaksRes ? peaksRes.peaks : (peaksRes as WaveformPeaks);
      const pyramidRes: WaveformPeaks[] | null =
        'peaks' in peaksRes ? (peaksRes.pyramid ?? null) : null;

      setState({
        peaks: finalPeaks,
        pyramid: pyramidRes,
        isLoading: false,
        error: null,
        progress: 1,
      });
    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      const message =
        err instanceof Error
          ? err.message
          : '파형 분석 중 오류가 발생했습니다.';
      setState({
        peaks: null,
        pyramid: null,
        isLoading: false,
        error: message,
        progress: 0,
      });
    }
  }, [videoBlob, bucketCount, options]);

  useEffect(() => {
    void extractPeaks();

    return () => {
      abortRef.current?.abort();
    };
  }, [extractPeaks]);

  const retry = useCallback(() => {
    void extractPeaks();
  }, [extractPeaks]);

  return {
    ...state,
    retry,
  } as const;
}
