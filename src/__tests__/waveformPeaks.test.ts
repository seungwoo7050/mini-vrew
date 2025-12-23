import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computePeaksInIdle } from '@/lib/waveformPeaks';

describe('computePeaksInIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    if (typeof window !== 'undefined') {
      delete (
        window as unknown as {
          requestIdleCallback?: (...args: unknown[]) => number;
        }
      ).requestIdleCallback;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty Int16Array for empty samples', async () => {
    const samples = new Float32Array(0);
    const p = computePeaksInIdle(samples, 10);
    const result = await p;
    expect(result).toBeInstanceOf(Int16Array);
    expect(result.length).toBe(20);
  });

  it('computes min/max peaks for simple sine wave', async () => {
    const samples = new Float32Array(100);
    for (let i = 0; i < 100; i++)
      samples[i] = Math.sin((i / 100) * Math.PI * 2);

    const p = computePeaksInIdle(samples, 10);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.length).toBe(20);
    for (let b = 0; b < 10; b++) {
      const min = result[b * 2];
      const max = result[b * 2 + 1];
      expect(min).toBeLessThanOrEqual(max);
      expect(min).toBeGreaterThanOrEqual(-32768);
      expect(max).toBeLessThanOrEqual(32767);
    }
  });

  it('handles constant signal correctly', async () => {
    const samples = new Float32Array(50).fill(0.5);
    const p = computePeaksInIdle(samples, 5);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.length).toBe(10);
    const expected = Math.round(0.5 * 32767);
    for (let b = 0; b < 5; b++) {
      expect(result[b * 2]).toBe(expected);
      expect(result[b * 2 + 1]).toBe(expected);
    }
  });

  it('clamps values outside [-1,1] range', async () => {
    const samples = new Float32Array([2.0, -2.0, 0.5]);
    const p = computePeaksInIdle(samples, 1);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result[0]).toBe(-32768);
    expect(result[1]).toBe(32767);
  });

  it('respects abort signal (immediate abort)', async () => {
    const samples = new Float32Array(1000);
    const controller = new AbortController();
    controller.abort();

    const p = computePeaksInIdle(samples, 100, controller.signal);
    await expect(p).rejects.toThrow('aborted');
  });

  it('respects abort signal (during processing)', async () => {
    const samples = new Float32Array(100000);
    const controller = new AbortController();

    const p = computePeaksInIdle(samples, 10000, controller.signal);
    controller.abort();

    await expect(p).rejects.toThrow('aborted');
  });

  it('handles single bucket correctly', async () => {
    const samples = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5]);
    const p = computePeaksInIdle(samples, 1);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.length).toBe(2);
    expect(result[0]).toBe(Math.round(-0.4 * 32767));
    expect(result[1]).toBe(Math.round(0.5 * 32767));
  });

  it('rms mode - constant signal', async () => {
    const samples = new Float32Array(50).fill(0.5);
    const p = computePeaksInIdle(samples, 5, undefined, { mode: 'rms' });
    await vi.runAllTimersAsync();
    const result = (await p) as Int16Array;

    expect(result.length).toBe(10);
    const expectedPos = Math.round(0.5 * 32767);
    const expectedNeg = Math.round(-0.5 * 32767);
    for (let b = 0; b < 5; b++) {
      expect(result[b * 2]).toBe(expectedNeg);
      expect(result[b * 2 + 1]).toBe(expectedPos);
    }
  });

  it('rms mode - sine approx', async () => {
    const samples = new Float32Array(100);
    for (let i = 0; i < 100; i++)
      samples[i] = Math.sin((i / 100) * Math.PI * 2);

    const p = computePeaksInIdle(samples, 10, undefined, { mode: 'rms' });
    await vi.runAllTimersAsync();
    const result = (await p) as Int16Array;

    const expected = Math.round((1 / Math.SQRT2) * 32767);

    const mags: number[] = [];
    for (let b = 0; b < 10; b++) {
      const min = result[b * 2];
      const max = result[b * 2 + 1];
      expect(min).toBeLessThanOrEqual(0);
      expect(max).toBeGreaterThanOrEqual(0);
      mags.push(Math.max(Math.abs(min), Math.abs(max)));
    }

    const maxMag = Math.max(...mags);
    expect(maxMag).toBeGreaterThanOrEqual(expected - 3000);
  });

  it('pyramid returns multiple levels', async () => {
    const samples = new Float32Array([-1, -0.5, 0.5, 1]);
    const p = computePeaksInIdle(samples, 4, undefined, {
      pyramidLevels: 3,
      returnPyramid: true,
    });
    await vi.runAllTimersAsync();
    const res = await p;
    if (!('peaks' in res && 'pyramid' in res)) {
      throw new Error('Expected pyramid result object');
    }

    const obj = res as { peaks: Int16Array; pyramid: Int16Array[] };
    const pyramid = obj.pyramid;

    expect(pyramid[0].length).toBe(8);
    expect(pyramid[1].length).toBe(4);
    expect(pyramid[2].length).toBe(2);

    expect(pyramid[0][0]).toBe(-32768);
    expect(pyramid[0][1]).toBe(-32768);
    expect(pyramid[2][0]).toBe(-32768);
    expect(pyramid[2][1]).toBe(32767);
  });
});
