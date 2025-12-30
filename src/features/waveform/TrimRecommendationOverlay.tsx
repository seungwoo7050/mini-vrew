import { memo } from 'react';

import { msToFraction } from '@/features/waveform/timeMapping';
import { type TrimRecommendation } from '@/features/waveform/trimRecommendations';

type Props = {
  recommendations: TrimRecommendation[];
  durationMs: number | null;
  activeIndex?: number | null;
  onSelect?: (index: number) => void;
};

function TrimRecommendationOverlay({
  recommendations,
  durationMs,
  activeIndex,
  onSelect,
}: Props) {
  if (!durationMs || durationMs <= 0 || recommendations.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden
    >
      {recommendations.map((rec, idx) => {
        const left = msToFraction(rec.startMs, durationMs, null, null);
        const right = msToFraction(rec.endMs, durationMs, null, null);
        const clampedLeft = Math.max(0, Math.min(1, left));
        const clampedRight = Math.max(clampedLeft, Math.min(1, right));
        const width = Math.max(0, clampedRight - clampedLeft);
        const isActive = idx === activeIndex;

        return (
          <button
            key={`${rec.startMs}-${rec.endMs}-${idx}`}
            type="button"
            onClick={() => onSelect?.(idx)}
            style={{
              position: 'absolute',
              left: `${clampedLeft * 100}%`,
              width: `${width * 100}%`,
              top: 0,
              bottom: 0,
              background: isActive
                ? 'rgba(14, 165, 233, 0.18)'
                : 'rgba(14, 165, 233, 0.08)',
              border: `1px solid ${
                isActive
                  ? 'rgba(14, 165, 233, 0.9)'
                  : 'rgba(14, 165, 233, 0.45)'
              }`,
              borderRadius: 6,
              pointerEvents: 'auto',
              cursor: 'pointer',
              boxShadow: isActive
                ? '0 6px 18px rgba(14,165,233,0.25)'
                : '0 2px 8px rgba(15,23,42,0.12)',
              transition: 'background 120ms ease, border-color 120ms ease',
            }}
            aria-label={`추천 구간 ${idx + 1}`}
          />
        );
      })}
    </div>
  );
}

export default memo(TrimRecommendationOverlay);
