import { useCallback, useRef, useState, type CSSProperties } from 'react';

import {
  MIN_TRIM_GAP_MS,
  type TrimRange,
} from '@/features/playback/useTrimRange';
import { fractionToMs, msToFraction } from '@/features/waveform/timeMapping';

type Props = {
  range: TrimRange;
  durationMs: number;
  viewStartMs?: number | null;
  viewEndMs?: number | null;
  onChangeStart: (ms: number) => void;
  onChangeEnd: (ms: number) => void;
  onChangeRange: (startMs: number, endMs: number) => void;
};

function TrimRangeOverlay({
  range,
  durationMs,
  viewStartMs,
  viewEndMs,
  onChangeStart,
  onChangeEnd,
  onChangeRange,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<'start' | 'end' | null>(null);
  const activeRef = useRef<'start' | 'end' | null>(null);
  const [pointerMs, setPointerMs] = useState<number | null>(null);
  const [pointerPos, setPointerPos] = useState<number | null>(null);

  const leftFraction = msToFraction(
    range.startMs,
    durationMs,
    viewStartMs,
    viewEndMs
  );
  const rightFraction = msToFraction(
    range.endMs,
    durationMs,
    viewStartMs,
    viewEndMs
  );
  const left = Math.min(leftFraction, rightFraction);
  const right = Math.max(leftFraction, rightFraction);
  const width = Math.max(0, right - left);

  const clientXToMs = useCallback(
    (clientX: number) => {
      const el = overlayRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const ratio = (clientX - rect.left) / rect.width;
      return fractionToMs(ratio, durationMs, viewStartMs, viewEndMs);
    },
    [durationMs, viewStartMs, viewEndMs]
  );

  const updatePointerInfo = useCallback(
    (clientX: number) => {
      const el = overlayRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ms = clientXToMs(clientX);
      setPointerMs(ms);
      setPointerPos(((clientX - rect.left) / rect.width) * 100);
    },
    [clientXToMs]
  );

  const startHandle = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setActive('start');
      activeRef.current = 'start';
      updatePointerInfo(e.clientX);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.preventDefault();
      updatePointerInfo(e.clientX);
      const ms = clientXToMs(e.clientX);
      if (ms === null) return;

      if (activeRef.current === 'end') {
        if (ms >= range.startMs + MIN_TRIM_GAP_MS) {
          onChangeEnd(ms);
        } else {
          onChangeRange(ms, range.startMs);
          activeRef.current = 'start';
          setActive('start');
        }
        return;
      }

      if (ms <= range.endMs - MIN_TRIM_GAP_MS) {
        onChangeStart(ms);
      } else {
        onChangeRange(range.endMs, ms);
        activeRef.current = 'end';
        setActive('end');
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setActive(null);
      activeRef.current = null;
      setPointerMs(null);
      setPointerPos(null);
    },
  };

  const endHandle = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setActive('end');
      activeRef.current = 'end';
      updatePointerInfo(e.clientX);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.preventDefault();
      updatePointerInfo(e.clientX);
      const ms = clientXToMs(e.clientX);
      if (ms === null) return;

      if (activeRef.current === 'start') {
        if (ms <= range.endMs - MIN_TRIM_GAP_MS) {
          onChangeStart(ms);
        } else {
          onChangeRange(range.endMs, ms);
          activeRef.current = 'end';
          setActive('end');
        }
        return;
      }

      if (ms >= range.startMs + MIN_TRIM_GAP_MS) {
        onChangeEnd(ms);
      } else {
        onChangeRange(ms, range.startMs);
        activeRef.current = 'start';
        setActive('start');
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setActive(null);
      activeRef.current = null;
      setPointerMs(null);
      setPointerPos(null);
    },
  };

  const overlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  };

  const rangeBoxStyle: CSSProperties = {
    position: 'absolute',
    left: `${left * 100}%`,
    width: `${width * 100}%`,
    top: 0,
    bottom: 0,
    background: 'rgba(var(--primary-rgb), 0.12)',
    border: '1px solid var(--primary)',
    pointerEvents: 'none',
  };

  const handleStyle = (positionLeft: string): CSSProperties => ({
    position: 'absolute',
    left: positionLeft,
    top: 0,
    bottom: 0,
    width: 20,
    marginLeft: -10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    cursor: 'col-resize',
    touchAction: 'none',
    opacity: 0.9,
  });

  const handleBarStyle: CSSProperties = {
    width: 4,
    height: '60%',
    background: 'var(--primary)',
    borderRadius: 2,
  };

  const tooltipStyle: CSSProperties = {
    position: 'absolute',
    left: `${Math.max(0, Math.min(pointerPos ?? 0, 100))}%`,
    transform: 'translateX(-50%)',
    top: -28,
    background: 'rgba(0,0,0,0.75)',
    color: '#fff',
    padding: '4px 6px',
    fontSize: 12,
    borderRadius: 4,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const msRemainder = Math.round(ms % 1000);
    return `${m}:${sec.toString().padStart(2, '0')}.${msRemainder
      .toString()
      .padStart(3, '0')}`;
  };

  return (
    <div ref={overlayRef} style={overlayStyle} aria-hidden>
      <div style={rangeBoxStyle} />
      <div
        data-testid="trim-handle-start"
        style={handleStyle(`${left * 100}%`)}
        {...startHandle}
      >
        <div style={handleBarStyle} />
      </div>
      <div
        data-testid="trim-handle-end"
        style={handleStyle(`${(left + width) * 100}%`)}
        {...endHandle}
      >
        <div style={handleBarStyle} />
      </div>
      {pointerMs !== null && pointerPos !== null && active ? (
        <div style={tooltipStyle}>{formatMs(pointerMs)}</div>
      ) : null}
    </div>
  );
}

export default TrimRangeOverlay;
