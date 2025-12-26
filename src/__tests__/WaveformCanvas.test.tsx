import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';

import WaveformCanvas from '@/features/waveform/WaveformCanvas';

function createMockCanvas() {
  const methods = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  };

  const ctx = { ...methods } as unknown as CanvasRenderingContext2D;

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function () {
      return ctx as unknown as CanvasRenderingContext2D;
    }
  );

  return methods;
}

describe('WaveformCanvas', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders waveform bars and playhead', () => {
    const m = createMockCanvas();

    const buckets = 10;
    const peaks = new Int16Array(buckets * 2);
    for (let i = 0; i < buckets; i++) {
      peaks[i * 2] = -1000;
      peaks[i * 2 + 1] = 1000;
    }

    const { container } = render(
      <WaveformCanvas
        peaks={peaks}
        width={200}
        height={40}
        playheadMs={500}
        durationMs={1000}
      />
    );

    const canv = container.querySelector('canvas')!;
    expect(canv).toBeTruthy();

    expect(m.fillRect).toHaveBeenCalled();
    expect(m.beginPath).toHaveBeenCalled();
    expect(m.moveTo).toHaveBeenCalled();
    expect(m.lineTo).toHaveBeenCalled();
    expect(m.stroke).toHaveBeenCalled();
  });

  it('limits drawing to view range', () => {
    const m1 = createMockCanvas();

    const buckets = 100;
    const peaks = new Int16Array(buckets * 2);
    for (let i = 0; i < buckets; i++) {
      peaks[i * 2] = -1000;
      peaks[i * 2 + 1] = 1000;
    }

    render(
      <WaveformCanvas
        peaks={peaks}
        width={400}
        height={40}
        durationMs={10000}
      />
    );
    const getCount = (fn: unknown) =>
      (fn as unknown as { mock?: { calls?: unknown[] } }).mock?.calls?.length ??
      0;
    const fullCalls = getCount(m1.fillRect);

    const m2 = createMockCanvas();
    render(
      <WaveformCanvas
        peaks={peaks}
        width={400}
        height={40}
        durationMs={10000}
        viewStartMs={2000}
        viewEndMs={7000}
      />
    );
    const viewCalls = getCount(m2.fillRect);

    expect(viewCalls).toBeLessThan(fullCalls);
  });

  it('renders sign-symmetric bars for rms-like peaks', () => {
    const m = createMockCanvas();

    const buckets = 10;
    const peaks = new Int16Array(buckets * 2);
    for (let i = 0; i < buckets; i++) {
      peaks[i * 2] = -5000;
      peaks[i * 2 + 1] = 5000;
    }

    render(
      <WaveformCanvas
        peaks={peaks}
        width={200}
        height={40}
        durationMs={1000}
        mode="rms"
      />
    );

    expect(m.fillRect).toHaveBeenCalled();
  });

  it('renders trim background when provided', () => {
    const m = createMockCanvas();

    const peaks = new Int16Array(0);

    render(
      <WaveformCanvas
        peaks={peaks}
        width={100}
        height={20}
        durationMs={1000}
        trimRange={{ startMs: 200, endMs: 600 }}
      />
    );

    expect(m.fillRect).toHaveBeenCalled();
  });
});
