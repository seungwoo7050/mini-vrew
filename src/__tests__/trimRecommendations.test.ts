import { computeTrimRecommendations } from '@/features/waveform/trimRecommendations';

function makePeaks(values: number[]) {
  const out = new Int16Array(values.length * 2);
  values.forEach((v, i) => {
    out[i * 2] = -v;
    out[i * 2 + 1] = v;
  });
  return out;
}

describe('computeTrimRecommendations', () => {
  it('returns top energy segments for highlight mode', () => {
    const peaks = makePeaks([1000, 9000, 9500, 1200]);
    const res = computeTrimRecommendations(peaks, 4000, {
      mode: 'highlight',
      count: 2,
      segmentMs: 1000,
    });

    expect(res).toHaveLength(2);
    expect(res[0].startMs).toBe(1000);
    expect(res[1].startMs).toBe(2000);
  });

  it('returns lowest energy segments for remove mode', () => {
    const peaks = makePeaks([1000, 9000, 9500, 1200]);
    const res = computeTrimRecommendations(peaks, 4000, {
      mode: 'remove',
      count: 2,
      segmentMs: 1000,
    });

    expect(res).toHaveLength(2);
    expect(res[0].startMs).toBe(0);
    expect(res[1].startMs).toBe(3000);
  });
});
