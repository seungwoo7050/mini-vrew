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
  segmentMs?: number;
};

const I16_MAX = 32767;

function clampSegmentMs(durationMs: number, segmentMs?: number) {
  if (durationMs <= 0) return 0;
  const base = segmentMs ?? Math.round(durationMs / 6);
  const clamped = Math.max(
    MIN_TRIM_GAP_MS,
    Math.min(base, Math.round(durationMs / 2))
  );
  return Math.min(clamped, durationMs);
}

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

function segmentScores(prefix: Float64Array, segmentBuckets: number) {
  const available = prefix.length - 1;
  const segmentCount = Math.max(0, available - segmentBuckets + 1);
  const scores = new Float64Array(segmentCount);
  for (let i = 0; i < segmentCount; i++) {
    scores[i] = prefix[i + segmentBuckets] - prefix[i];
  }
  return scores;
}

export function computeTrimRecommendations(
  peaks: WaveformPeaks | null,
  durationMs: number | null,
  options: RecommendationOptions
): TrimRecommendation[] {
  if (!peaks || !durationMs || durationMs <= 0) return [];

  const { bucketCount, prefix } = buildAmplitudeSums(peaks);
  const segmentMs = clampSegmentMs(durationMs, options.segmentMs);
  if (segmentMs <= 0) return [];

  const segmentBuckets = Math.max(
    1,
    Math.round((segmentMs / durationMs) * bucketCount)
  );
  if (segmentBuckets >= bucketCount) {
    return [
      {
        startMs: 0,
        endMs: durationMs,
        score: prefix[prefix.length - 1],
      },
    ];
  }

  const scores = segmentScores(prefix, segmentBuckets);
  if (scores.length === 0) return [];

  const weighted = (() => {
    if (options.mode === 'remove') {
      const maxScore = Math.max(...scores);
      return scores.map((s) => maxScore - s);
    }
    return scores.slice();
  })();

  const K = Math.max(1, Math.min(options.count, scores.length));
  const n = scores.length;
  const dp = Array.from({ length: K + 1 }, () =>
    new Float64Array(n).fill(Number.NEGATIVE_INFINITY)
  );
  const prevIdx: number[][] = Array.from({ length: K + 1 }, () =>
    new Array(n).fill(-1)
  );
  const took: boolean[][] = Array.from({ length: K + 1 }, () =>
    new Array(n).fill(false)
  );

  for (let i = 0; i < n; i++) {
    dp[1][i] = weighted[i];
    prevIdx[1][i] = i - segmentBuckets;
    took[1][i] = true;
    if (i > 0 && dp[1][i - 1] >= dp[1][i]) {
      dp[1][i] = dp[1][i - 1];
      prevIdx[1][i] = prevIdx[1][i - 1];
      took[1][i] = false;
    }
  }

  for (let k = 2; k <= K; k++) {
    for (let i = 0; i < n; i++) {
      const prevCandidate = i - segmentBuckets;
      let takeScore = Number.NEGATIVE_INFINITY;
      if (
        prevCandidate >= 0 &&
        dp[k - 1][prevCandidate] > Number.NEGATIVE_INFINITY / 2
      ) {
        takeScore = dp[k - 1][prevCandidate] + weighted[i];
      } else if (prevCandidate < 0 && k === 1) {
        takeScore = weighted[i];
      }

      const skipScore = i > 0 ? dp[k][i - 1] : Number.NEGATIVE_INFINITY;

      if (takeScore >= skipScore) {
        dp[k][i] = takeScore;
        prevIdx[k][i] = prevCandidate;
        took[k][i] = true;
      } else {
        dp[k][i] = skipScore;
        prevIdx[k][i] = i > 0 ? prevIdx[k][i - 1] : -1;
        took[k][i] = false;
      }
    }
  }

  let bestK = 1;
  const bestI = n - 1;
  let bestScore = dp[1][bestI];
  for (let k = 2; k <= K; k++) {
    if (dp[k][n - 1] > bestScore) {
      bestScore = dp[k][n - 1];
      bestK = k;
    }
  }

  const segments: number[] = [];
  let k = bestK;
  let i = n - 1;
  while (k > 0 && i >= 0) {
    if (took[k][i]) {
      segments.push(i);
      i = prevIdx[k][i];
      k -= 1;
    } else {
      i -= 1;
    }
  }

  segments.sort((a, b) => a - b);

  const toMs = (startBucket: number) =>
    Math.round((startBucket / bucketCount) * durationMs);

  return segments.map((startIdx) => {
    const startMs = toMs(startIdx);
    const endBucket = startIdx + segmentBuckets;
    const endMs = Math.min(durationMs, toMs(endBucket));
    return { startMs, endMs, score: scores[startIdx] };
  });
}
