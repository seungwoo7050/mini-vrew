export type ViewRange = {
  durationMs: number;
  viewStartMs: number;
  viewEndMs: number;
  viewDurationMs: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveViewRange(
  durationMs: number | null | undefined,
  viewStartMs?: number | null,
  viewEndMs?: number | null
): ViewRange {
  const safeDuration = Math.max(0, durationMs ?? 0);
  const start = clamp(viewStartMs ?? 0, 0, safeDuration);
  const end = clamp(viewEndMs ?? safeDuration, 0, safeDuration);
  const orderedStart = Math.min(start, end);
  const orderedEnd = Math.max(start, end);
  const viewDurationMs = Math.max(0, orderedEnd - orderedStart);

  return {
    durationMs: safeDuration,
    viewStartMs: orderedStart,
    viewEndMs: orderedEnd,
    viewDurationMs,
  };
}

export function msToFraction(
  ms: number,
  durationMs: number | null | undefined,
  viewStartMs?: number | null,
  viewEndMs?: number | null
) {
  const { viewStartMs: start, viewDurationMs } = resolveViewRange(
    durationMs,
    viewStartMs,
    viewEndMs
  );

  if (viewDurationMs <= 0) return 0;

  const fraction = (ms - start) / viewDurationMs;
  return clamp(fraction, 0, 1);
}

export function fractionToMs(
  fraction: number,
  durationMs: number | null | undefined,
  viewStartMs?: number | null,
  viewEndMs?: number | null
) {
  const { viewStartMs: start, viewDurationMs } = resolveViewRange(
    durationMs,
    viewStartMs,
    viewEndMs
  );
  const clamped = clamp(fraction, 0, 1);
  return start + clamped * viewDurationMs;
}
