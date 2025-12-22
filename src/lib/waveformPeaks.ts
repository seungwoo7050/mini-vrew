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

export type ComputePeaksMode = 'peaks' | 'rms';

export type ComputePeaksOptions = {
  mode?: ComputePeaksMode;
  pyramidLevels?: number;
  returnPyramid?: boolean;
};

export function computePeaksInIdle(
  samples: Float32Array,
  bucketCount: number,
  signal?: AbortSignal,
  options?: ComputePeaksOptions
): Promise<WaveformPeaks | { peaks: WaveformPeaks; pyramid: WaveformPeaks[] }> {
  const buckets = Math.max(1, Math.floor(bucketCount));
  const out = new Int16Array(buckets * 2);

  if (samples.length === 0) return Promise.resolve(out);

  const n = samples.length;
  const samplesPerBucket = n / buckets;
  let bucketIndex = 0;

  const mode: ComputePeaksMode = options?.mode ?? 'peaks';

  const minArr = mode === 'peaks' ? new Float32Array(buckets) : undefined;
  const maxArr = mode === 'peaks' ? new Float32Array(buckets) : undefined;

  const sumSqArr = mode === 'rms' ? new Float64Array(buckets) : undefined;
  const countArr = mode === 'rms' ? new Uint32Array(buckets) : undefined;

  const stepBucket = () => {
    const start = Math.floor(bucketIndex * samplesPerBucket);
    const end = Math.min(n, Math.floor((bucketIndex + 1) * samplesPerBucket));

    if (mode === 'peaks') {
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

      minArr![bucketIndex] = min;
      maxArr![bucketIndex] = max;
    } else {
      let sumSq = 0;
      let cnt = 0;
      for (let i = start; i < end; i++) {
        const v = samples[i];
        sumSq += v * v;
        cnt++;
      }
      if (cnt === 0) {
        sumSq = 0;
      }
      sumSqArr![bucketIndex] = sumSq;
      countArr![bucketIndex] = cnt;
    }

    bucketIndex++;
  };

  const hasRIC =
    typeof window !== 'undefined' && 'requestIdleCallback' in window;

  const MIN_IDLE_TIME = 4;
  const CHUNK_SIZE = 32;

  return new Promise<
    WaveformPeaks | { peaks: WaveformPeaks; pyramid: WaveformPeaks[] }
  >((resolve, reject) => {
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

    const finish = (
      result:
        | WaveformPeaks
        | { peaks: WaveformPeaks; pyramid: WaveformPeaks[] }
        | null,
      err?: DOMException
    ) => {
      if (settled) return;
      settled = true;
      clearScheduled();
      if (err) {
        reject(err);
      } else {
        resolve(
          result as
            | WaveformPeaks
            | { peaks: WaveformPeaks; pyramid: WaveformPeaks[] }
        );
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
        const baseOut = new Int16Array(buckets * 2);

        if (mode === 'peaks') {
          for (let i = 0; i < buckets; i++) {
            baseOut[i * 2] = floatToI16(minArr![i]);
            baseOut[i * 2 + 1] = floatToI16(maxArr![i]);
          }
        } else {
          for (let i = 0; i < buckets; i++) {
            const cnt = countArr![i] ?? 0;
            const rms = cnt > 0 ? Math.sqrt((sumSqArr![i] ?? 0) / cnt) : 0;
            baseOut[i * 2] = floatToI16(-rms);
            baseOut[i * 2 + 1] = floatToI16(rms);
          }
        }

        const levels = Math.max(1, Math.floor(options?.pyramidLevels ?? 1));
        const returnPyramid = Boolean(options?.returnPyramid);

        if (!returnPyramid || levels === 1) {
          finish(baseOut);
          return;
        }

        const pyramid: WaveformPeaks[] = [];

        const buildNextPeaksFromPeaks = (
          prevMin: Float32Array,
          prevMax: Float32Array
        ) => {
          const prevN = prevMin.length;
          const nextN = Math.ceil(prevN / 2);
          const nextMin = new Float32Array(nextN);
          const nextMax = new Float32Array(nextN);
          for (let j = 0; j < nextN; j++) {
            const a = j * 2;
            const b = Math.min(prevN, a + 2);
            let mn = 1;
            let mx = -1;
            for (let k = a; k < b; k++) {
              const vmin = prevMin[k];
              const vmax = prevMax[k];
              if (vmin < mn) mn = vmin;
              if (vmax > mx) mx = vmax;
            }
            nextMin[j] = mn;
            nextMax[j] = mx;
          }
          const outA = new Int16Array(nextN * 2);
          for (let i = 0; i < nextN; i++) {
            outA[i * 2] = floatToI16(nextMin[i]);
            outA[i * 2 + 1] = floatToI16(nextMax[i]);
          }
          return { min: nextMin, max: nextMax, peaks: outA };
        };

        const buildNextPeaksFromRms = (
          prevSumSq: Float64Array,
          prevCount: Uint32Array
        ) => {
          const prevN = prevCount.length;
          const nextN = Math.ceil(prevN / 2);
          const nextSum = new Float64Array(nextN);
          const nextCount = new Uint32Array(nextN);
          for (let j = 0; j < nextN; j++) {
            const a = j * 2;
            const b = Math.min(prevN, a + 2);
            let s = 0;
            let c = 0;
            for (let k = a; k < b; k++) {
              s += prevSumSq[k];
              c += prevCount[k];
            }
            nextSum[j] = s;
            nextCount[j] = c;
          }
          const outA = new Int16Array(nextN * 2);
          for (let i = 0; i < nextN; i++) {
            const cnt = nextCount[i];
            const rms = cnt > 0 ? Math.sqrt(nextSum[i] / cnt) : 0;
            outA[i * 2] = floatToI16(-rms);
            outA[i * 2 + 1] = floatToI16(rms);
          }
          return { sum: nextSum, count: nextCount, peaks: outA };
        };

        pyramid.push(baseOut);

        if (mode === 'peaks') {
          let curMin = minArr!;
          let curMax = maxArr!;
          for (let level = 1; level < levels; level++) {
            const res = buildNextPeaksFromPeaks(curMin, curMax);
            pyramid.push(res.peaks);
            curMin = res.min;
            curMax = res.max;
          }
        } else {
          let curSum = sumSqArr!;
          let curCount = countArr!;
          for (let level = 1; level < levels; level++) {
            const res = buildNextPeaksFromRms(curSum, curCount);
            pyramid.push(res.peaks);
            curSum = res.sum;
            curCount = res.count;
          }
        }

        finish({ peaks: baseOut, pyramid });
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
