export type WaveformPeaks = Int16Array;

function clampSignedUnit(v: number) {
  if (v < -1) return -1;
  if (v > 1) return 1;
  return v;
}

function floatToI16(v: number) {
  const x = clampSignedUnit(v);
  if (x <= -1) return -32768;
  if (x >= 1) return 32767;
  return Math.round(x * 32767);
}

export function computePeaksInIdle(
  samples: Float32Array,
  bucketCount: number,
  signal?: AbortSignal
): Promise<WaveformPeaks> {
  const buckets = Math.max(1, Math.floor(bucketCount));
  const out = new Int16Array(buckets * 2);

  if (samples.length === 0) return Promise.resolve(out);

  const n = samples.length;
  const samplesPerBucket = n / buckets;
  let bucketIndex = 0;

  const stepBucket = () => {
    const start = Math.floor(bucketIndex * samplesPerBucket);
    const end = Math.min(n, Math.floor((bucketIndex + 1) * samplesPerBucket));

    let min = 1;
    let max = -1;

    for (let i = start; i < end; i++) {
      const v = samples[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }

    if (end <= start) {
      min = 0;
      max = 0;
    }

    out[bucketIndex * 2] = floatToI16(min);
    out[bucketIndex * 2 + 1] = floatToI16(max);
    bucketIndex++;
  };

  const hasRIC =
    typeof window !== 'undefined' && 'requestIdleCallback' in window;

  const MIN_IDLE_TIME = 4;
  const CHUNK_SIZE = 32;

  return new Promise<WaveformPeaks>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }

    let settled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const clearScheduled = () => {
      if (idleHandle !== null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleHandle);
        idleHandle = null;
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const finish = (result: WaveformPeaks | null, err?: DOMException) => {
      if (settled) return;
      settled = true;
      clearScheduled();
      if (err) {
        reject(err);
      } else {
        resolve(result!);
      }
    };

    const loop = (deadline?: IdleDeadline) => {
      if (settled) return;

      if (signal?.aborted) {
        finish(null, new DOMException('aborted', 'AbortError'));
        return;
      }

      if (hasRIC && deadline) {
        while (
          bucketIndex < buckets &&
          deadline.timeRemaining() > MIN_IDLE_TIME
        )
          stepBucket();
      } else {
        const endB = Math.min(buckets, bucketIndex + CHUNK_SIZE);
        while (bucketIndex < endB) stepBucket();
      }

      if (bucketIndex >= buckets) {
        finish(out);
        return;
      }

      if (hasRIC) {
        idleHandle = (window as Window).requestIdleCallback(loop);
      } else {
        timeoutHandle = window.setTimeout(() => {
          timeoutHandle = null;
          loop(undefined);
        }, 0);
      }
    };

    if (hasRIC) {
      idleHandle = (window as Window).requestIdleCallback(loop);
    } else {
      timeoutHandle = window.setTimeout(() => {
        timeoutHandle = null;
        loop(undefined);
      }, 0);
    }

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          finish(null, new DOMException('aborted', 'AbortError'));
        },
        { once: true }
      );
    }
  });
}
