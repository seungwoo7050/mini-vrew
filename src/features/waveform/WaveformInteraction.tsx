import { useCallback, useRef, useState, type ReactNode } from 'react';

import { fractionToMs } from '@/features/waveform/timeMapping';

type Props = {
  durationMs: number | null;
  onSeek: (timeMs: number) => void;
  children: ReactNode;
  className?: string;
  viewStartMs?: number | null;
  viewEndMs?: number | null;
};

function WaveformInteraction({
  durationMs,
  onSeek,
  children,
  className,
  viewStartMs,
  viewEndMs,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clientXToTimeMs = useCallback(
    (clientX: number): number | null => {
      const el = containerRef.current;
      if (!el || !durationMs || durationMs <= 0) return null;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return null;

      const ratio = (clientX - rect.left) / rect.width;
      const timeMs = fractionToMs(ratio, durationMs, viewStartMs, viewEndMs);
      return Math.round(timeMs);
    },
    [durationMs, viewStartMs, viewEndMs]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);

      const timeMs = clientXToTimeMs(e.clientX);
      if (timeMs !== null) {
        onSeek(timeMs);
      }
    },
    [clientXToTimeMs, onSeek]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

      const timeMs = clientXToTimeMs(e.clientX);
      if (timeMs !== null) {
        onSeek(timeMs);
      }
    },
    [isDragging, clientXToTimeMs, onSeek]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setIsDragging(false);
    },
    []
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setIsDragging(false);
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'pointer',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      role="slider"
      aria-label="재생 위치"
      aria-valuemin={0}
      aria-valuemax={durationMs ?? 0}
    >
      {children}
    </div>
  );
}

export default WaveformInteraction;
