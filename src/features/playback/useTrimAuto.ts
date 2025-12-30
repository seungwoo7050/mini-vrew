import { useCallback, useMemo, useState } from 'react';

import {
  computeTrimRecommendations,
  type RecommendationMode,
  type TrimRecommendation,
} from '@/features/waveform/trimRecommendations';
import { type WaveformPeaks } from '@/lib/waveformPeaks';

export type UseTrimAutoOptions = {
  peaks: WaveformPeaks | null;
  durationMs: number | null;
  mode: RecommendationMode;
  count: number;
  targetSegmentMs?: number;
  onApply?: (
    range: TrimRecommendation,
    meta: { autoEnableGuard: boolean }
  ) => void;
};

export function useTrimAuto({
  peaks,
  durationMs,
  mode,
  count,
  targetSegmentMs,
  onApply,
}: UseTrimAutoOptions) {
  const [recommendations, setRecommendations] = useState<TrimRecommendation[]>(
    []
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeRecommendation = useMemo(() => {
    if (activeIndex == null) return null;
    return recommendations[activeIndex] ?? null;
  }, [activeIndex, recommendations]);

  const generate = useCallback(() => {
    if (!peaks || !durationMs || durationMs <= 0) {
      setMessage('파형이 아직 준비되지 않았습니다.');
      setRecommendations([]);
      setActiveIndex(null);
      return;
    }

    setIsGenerating(true);
    const recs = computeTrimRecommendations(peaks, durationMs, {
      mode,
      count,
      segmentMs: targetSegmentMs,
    });
    setIsGenerating(false);

    if (!recs.length) {
      setMessage('추천할 구간을 찾지 못했습니다.');
      setRecommendations([]);
      setActiveIndex(null);
      return;
    }

    setRecommendations(recs);
    setActiveIndex(0);
    setMessage(`${recs.length}개 구간을 추천했어요. 원하는 구간을 적용하세요.`);
    onApply?.(recs[0], { autoEnableGuard: true });
  }, [count, durationMs, mode, onApply, peaks, targetSegmentMs]);

  const apply = useCallback(
    (index: number) => {
      const rec = recommendations[index];
      if (!rec) return;
      setActiveIndex(index);
      onApply?.(rec, { autoEnableGuard: true });
    },
    [onApply, recommendations]
  );

  return {
    recommendations,
    activeIndex,
    activeRecommendation,
    message,
    isGenerating,
    generate,
    apply,
  } as const;
}
