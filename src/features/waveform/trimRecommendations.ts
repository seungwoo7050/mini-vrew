import {
  MIN_TRIM_GAP_MS,
  type TrimRange,
} from '@/features/playback/useTrimRange';
import { type WaveformPeaks } from '@/lib/waveformPeaks';

export type RecommendationMode = 'highlight' | 'remove';

export type TrimRecommendation = TrimRange & { score: number };

export type RecommendationOptions = {
  mode: RecommendationMode;
  count: number;
  /**
   * Optional target segment length in milliseconds. Acts as a hint rather than a strict
   * fixed size. The algorithm will search around this target to find better fitting
   * segments using dynamic programming.
   */
  segmentMs?: number;
};

const I16_MAX = 32767;

function buildAmplitudeSums(peaks: WaveformPeaks) {
  const bucketCount = Math.floor(peaks.length / 2);
  const sums = new Float64Array(bucketCount + 1);

  for (let i = 0; i < bucketCount; i++) {
    const min = Math.abs(peaks[i * 2]);
    const max = Math.abs(peaks[i * 2 + 1]);
    const amplitude = (min + max) / (2 * I16_MAX);
    sums[i + 1] = sums[i] + amplitude;
  }

  return { bucketCount, prefix: sums } as const;
}

function deriveSegmentWindow(
  durationMs: number,
  bucketCount: number,
  targetSegmentMs?: number
) {
  if (durationMs <= 0 || bucketCount <= 0) {
    return { minBuckets: 0, maxBuckets: 0 } as const;
  }

  const target = Math.max(
    MIN_TRIM_GAP_MS,
    Math.min(targetSegmentMs ?? Math.round(durationMs / 6), durationMs)
  );
  const minMs = Math.max(MIN_TRIM_GAP_MS * 4, Math.round(target * 0.6));
  const maxMs = Math.max(minMs + MIN_TRIM_GAP_MS, Math.round(target * 1.6));

  const bucketFromMs = (ms: number) =>
    Math.max(1, Math.round((ms / durationMs) * bucketCount));

  const minBuckets = bucketFromMs(minMs);
  const maxBuckets = Math.max(minBuckets, bucketFromMs(maxMs));

  return { minBuckets, maxBuckets } as const;
}

type Candidate = {
  startBucket: number;
  endBucket: number;
  score: number;
};

function buildCandidates(
  prefix: Float64Array,
  bucketCount: number,
  minBuckets: number,
  maxBuckets: number
) {
  const candidates: Candidate[] = [];
  if (minBuckets <= 0 || maxBuckets <= 0) return candidates;

  const lengthStep = Math.max(1, Math.floor(minBuckets / 2));

  for (let start = 0; start < bucketCount; start++) {
    const available = bucketCount - start;
    const maxLen = Math.min(maxBuckets, available);
    for (let len = minBuckets; len <= maxLen; len += lengthStep) {
      const end = start + len;
      const score = prefix[end] - prefix[start];
      candidates.push({ startBucket: start, endBucket: end, score });
    }

    if ((maxLen - minBuckets) % lengthStep !== 0 && maxLen >= minBuckets) {
      const end = start + maxLen;
      const score = prefix[end] - prefix[start];
      candidates.push({ startBucket: start, endBucket: end, score });
    }
  }

  return candidates;
}

export function computeTrimRecommendations(
  peaks: WaveformPeaks | null,
  durationMs: number | null,
  options: RecommendationOptions
): TrimRecommendation[] {
  if (!peaks || !durationMs || durationMs <= 0) return [];

  const { bucketCount, prefix } = buildAmplitudeSums(peaks);
  const { minBuckets, maxBuckets } = deriveSegmentWindow(
    durationMs,
    bucketCount,
    options.segmentMs
  );

  if (minBuckets <= 0 || maxBuckets <= 0) return [];
  if (maxBuckets >= bucketCount) {
    return [
      { startMs: 0, endMs: durationMs, score: prefix[prefix.length - 1] },
    ];
  }

  const candidates = buildCandidates(
    prefix,
    bucketCount,
    minBuckets,
    maxBuckets
  );
  if (!candidates.length) return [];

  const baseScores = candidates.map((c) => c.score);
  const maxScore = Math.max(...baseScores);
  const weights = baseScores.map((score) =>
    options.mode === 'remove' ? maxScore - score : score
  );

  const sorted = candidates
    .map((c, idx) => ({ ...c, weight: weights[idx] }))
    .sort((a, b) => a.endBucket - b.endBucket);

  const ends = sorted.map((c) => c.endBucket);
  const prevNonOverlap: number[] = new Array(sorted.length).fill(-1);
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].startBucket;
    let lo = 0;
    let hi = i - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (ends[mid] <= start) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    prevNonOverlap[i] = found;
  }

  const K = Math.max(1, Math.min(options.count, sorted.length));
  const n = sorted.length;
  const dp = Array.from({ length: K + 1 }, () => new Float64Array(n));
  const choose: boolean[][] = Array.from({ length: K + 1 }, () =>
    new Array(n).fill(false)
  );

  for (let i = 0; i < n; i++) {
    const take = sorted[i].weight;
    const skip = i > 0 ? dp[1][i - 1] : 0;
    if (take >= skip) {
      dp[1][i] = take;
      choose[1][i] = true;
    } else {
      dp[1][i] = skip;
    }
  }

  for (let k = 2; k <= K; k++) {
    for (let i = 0; i < n; i++) {
      const prev = prevNonOverlap[i];
      const take = sorted[i].weight + (prev >= 0 ? dp[k - 1][prev] : 0);
      const skip = i > 0 ? dp[k][i - 1] : 0;
      if (take >= skip) {
        dp[k][i] = take;
        choose[k][i] = true;
      } else {
        dp[k][i] = skip;
      }
    }
  }

  let bestK = 1;
  let bestScore = dp[1][n - 1];
  for (let k = 2; k <= K; k++) {
    if (dp[k][n - 1] > bestScore) {
      bestScore = dp[k][n - 1];
      bestK = k;
    }
  }

  const chosen: number[] = [];
  let k = bestK;
  let i = n - 1;
  while (k > 0 && i >= 0) {
    if (choose[k][i]) {
      chosen.push(i);
      i = prevNonOverlap[i];
      k -= 1;
    } else {
      i -= 1;
    }
  }

  const toMs = (bucket: number) =>
    Math.round((bucket / bucketCount) * durationMs);

  return chosen
    .map((idx) => sorted[idx])
    .sort((a, b) => a.startBucket - b.startBucket)
    .map((c) => ({
      startMs: toMs(c.startBucket),
      endMs: Math.min(durationMs, toMs(c.endBucket)),
      score: c.score,
    }));
}
