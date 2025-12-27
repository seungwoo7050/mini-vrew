import { useCallback, useEffect, useState } from 'react';

export type TrimRange = {
  startMs: number;
  endMs: number;
};

export const MIN_TRIM_GAP_MS = 50;
const DEFAULT_TRIM_LENGTH_MS = 1000;

function isValidDuration(durationMs: number | null): durationMs is number {
  return (
    typeof durationMs === 'number' &&
    Number.isFinite(durationMs) &&
    durationMs > 0
  );
}

export function useTrimRange(durationMs: number | null) {
  const [range, setRange] = useState<TrimRange | null>(null);

  const normalize = useCallback(
    (next: TrimRange | null): TrimRange | null => {
      if (!isValidDuration(durationMs) || !next) return null;

      const clamp = (value: number) => Math.max(0, Math.min(value, durationMs));
      const start = clamp(next.startMs);
      const end = clamp(next.endMs);

      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      if (end - start < MIN_TRIM_GAP_MS) return null;

      return { startMs: start, endMs: end };
    },
    [durationMs]
  );

  useEffect(() => {
    setRange((prev) => {
      if (!isValidDuration(durationMs) || !prev) return null;

      const clamp = (value: number) => Math.max(0, Math.min(value, durationMs));
      const start = clamp(prev.startMs);
      const end = clamp(prev.endMs);

      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      if (end - start < MIN_TRIM_GAP_MS) return null;

      return { startMs: start, endMs: end };
    });
  }, [durationMs]);

  const setRangeSafe = useCallback(
    (startMs: number, endMs: number) => {
      setRange((prev) => normalize({ startMs, endMs }) ?? prev ?? null);
    },
    [normalize]
  );

  const setStart = useCallback(
    (startMs: number) => {
      setRange((prev) => {
        const fallbackEnd = isValidDuration(durationMs)
          ? Math.min(startMs + DEFAULT_TRIM_LENGTH_MS, durationMs)
          : startMs + DEFAULT_TRIM_LENGTH_MS;
        const end = prev?.endMs ?? fallbackEnd;
        return normalize({ startMs, endMs: end }) ?? prev ?? null;
      });
    },
    [durationMs, normalize]
  );

  const setEnd = useCallback(
    (endMs: number) => {
      setRange((prev) => {
        const fallbackStart = Math.max(0, endMs - DEFAULT_TRIM_LENGTH_MS);
        const start = prev?.startMs ?? fallbackStart;
        return normalize({ startMs: start, endMs }) ?? prev ?? null;
      });
    },
    [normalize]
  );

  const clear = useCallback(() => setRange(null), []);

  return {
    range,
    actions: {
      setRange: setRangeSafe,
      setStart,
      setEnd,
      clear,
    },
  } as const;
}
