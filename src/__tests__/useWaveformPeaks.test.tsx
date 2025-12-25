import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { useWaveformPeaks } from '@/features/waveform/useWaveformPeaks';
import type { ComputePeaksOptions } from '@/lib/waveformPeaks';

function TestHarness({
  blob,
  buckets = 100,
  options,
}: {
  blob: Blob | null;
  buckets?: number;
  options?: ComputePeaksOptions;
}) {
  const { peaks, pyramid, isLoading, error, progress, retry } =
    useWaveformPeaks({
      videoBlob: blob,
      bucketCount: buckets,
      options,
    });
  return (
    <div>
      <div data-testid="isLoading">{String(isLoading)}</div>
      <div data-testid="progress">{String(progress)}</div>
      <div data-testid="error">{String(error ?? '')}</div>
      <div data-testid="peaksLen">{peaks ? peaks.length : -1}</div>
      <div data-testid="firstPair">
        {peaks ? `${peaks[0]},${peaks[1]}` : ''}
      </div>
      <div data-testid="pyramidLen">{pyramid ? pyramid.length : -1}</div>
      <button data-testid="retry" onClick={() => retry()}>
        retry
      </button>
    </div>
  );
}

describe('useWaveformPeaks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    const g = globalThis as unknown as { AudioContext?: unknown };
    delete g.AudioContext;
  });

  it('returns initial values when no blob', async () => {
    render(<TestHarness blob={null} />);
    expect(screen.getByTestId('isLoading').textContent).toBe('false');
    expect(screen.getByTestId('progress').textContent).toBe('0');
    expect(screen.getByTestId('peaksLen').textContent).toBe('-1');
  });

  it('successfully computes peaks from decoded audio', async () => {
    class FakeAudioBuffer {
      numberOfChannels = 1;
      length = 100;
      private data = new Float32Array(100).map((_, i) =>
        Math.sin((i / 100) * Math.PI * 2)
      );
      getChannelData() {
        return this.data;
      }
    }

    class FakeAudioContext {
      decodeAudioData = async () => {
        return new FakeAudioBuffer() as unknown as AudioBuffer;
      };
      close = async () => {};
    }

    (globalThis as unknown as { AudioContext?: unknown }).AudioContext =
      FakeAudioContext as unknown as new (...args: unknown[]) => unknown;

    const fakeBlob = {
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as Blob;

    vi.useRealTimers();
    render(<TestHarness blob={fakeBlob} buckets={10} />);

    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('true')
    );

    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('false')
    );
    expect(Number(screen.getByTestId('peaksLen').textContent)).toBeGreaterThan(
      0
    );
    expect(screen.getByTestId('progress').textContent).toBe('1');
  });

  it('handles decode failure gracefully', async () => {
    class FailingAudioContext {
      decodeAudioData = async () => {
        throw new Error('decode failed');
      };
      close = async () => {};
    }

    (globalThis as unknown as { AudioContext?: unknown }).AudioContext =
      FailingAudioContext as unknown as new (...args: unknown[]) => unknown;

    const fakeBlob = {
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as Blob;

    vi.useRealTimers();
    render(<TestHarness blob={fakeBlob} buckets={10} />);

    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('true')
    );

    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('false')
    );
    expect(screen.getByTestId('error').textContent).toMatch(/오디오/);
    expect(screen.getByTestId('peaksLen').textContent).toBe('-1');
  });

  it('aborts previous extraction when blob changes', async () => {
    class SlowAudioBuffer {
      numberOfChannels = 1;
      length = 1000000;
      getChannelData() {
        return new Float32Array(this.length).fill(0.1);
      }
    }

    class SlowAudioContext {
      decodeAudioData = async () =>
        new SlowAudioBuffer() as unknown as AudioBuffer;
      close = async () => {};
    }

    (globalThis as unknown as { AudioContext?: unknown }).AudioContext =
      SlowAudioContext as unknown as new (...args: unknown[]) => unknown;

    const blobA = {
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as Blob;
    const blobB = {
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as Blob;

    vi.useRealTimers();
    const { rerender } = render(<TestHarness blob={blobA} buckets={10} />);

    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('true')
    );

    rerender(<TestHarness blob={blobB} buckets={10} />);

    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('false')
    );
  });

  it('supports rms mode via options', async () => {
    class FakeAudioBuffer {
      numberOfChannels = 1;
      length = 100;
      private data = new Float32Array(100).map((_, i) =>
        Math.sin((i / 100) * Math.PI * 2)
      );
      getChannelData() {
        return this.data;
      }
    }

    class FakeAudioContext {
      decodeAudioData = async () =>
        new FakeAudioBuffer() as unknown as AudioBuffer;
      close = async () => {};
    }

    (globalThis as unknown as { AudioContext?: unknown }).AudioContext =
      FakeAudioContext as unknown as new (...args: unknown[]) => unknown;

    const fakeBlob = {
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as Blob;

    vi.useRealTimers();
    render(
      <TestHarness blob={fakeBlob} buckets={10} options={{ mode: 'rms' }} />
    );

    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('true')
    );
    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('false')
    );

    const firstPair =
      screen.getByTestId('firstPair').textContent?.split(',').map(Number) ?? [];
    expect(firstPair.length).toBe(2);
    expect(firstPair[0]).toBe(-firstPair[1]);
  });

  it('returns pyramid when requested', async () => {
    class FakeAudioBuffer2 {
      numberOfChannels = 1;
      length = 100;
      private data = new Float32Array(100).fill(0.5);
      getChannelData() {
        return this.data;
      }
    }

    class FakeAudioContext2 {
      decodeAudioData = async () =>
        new FakeAudioBuffer2() as unknown as AudioBuffer;
      close = async () => {};
    }

    (globalThis as unknown as { AudioContext?: unknown }).AudioContext =
      FakeAudioContext2 as unknown as new (...args: unknown[]) => unknown;

    const fakeBlob = {
      arrayBuffer: async () => new ArrayBuffer(8),
    } as unknown as Blob;

    vi.useRealTimers();
    render(
      <TestHarness
        blob={fakeBlob}
        buckets={16}
        options={{ returnPyramid: true, pyramidLevels: 2 }}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('true')
    );
    await waitFor(() =>
      expect(screen.getByTestId('isLoading').textContent).toBe('false')
    );

    expect(
      Number(screen.getByTestId('pyramidLen').textContent)
    ).toBeGreaterThan(0);
  });
});
