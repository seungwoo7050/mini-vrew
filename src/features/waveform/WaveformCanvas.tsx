import { useEffect, useRef } from 'react';

import type { WaveformPeaks } from '@/lib/waveformPeaks';
import {
  msToFraction,
  resolveViewRange,
} from '@/features/waveform/timeMapping';

type Props = {
  peaks: WaveformPeaks | null;
  width: number;
  height: number;
  playheadMs?: number | null;
  durationMs?: number | null;
  viewStartMs?: number | null;
  viewEndMs?: number | null;
  trimRange?: { startMs: number; endMs: number } | null;
  mode?: 'peaks' | 'rms';
  colorWave?: string;
  colorTrim?: string;
  colorPlayhead?: string;
  className?: string;
};

function WaveformCanvas({
  peaks,
  width,
  height,
  playheadMs,
  durationMs,
  viewStartMs,
  viewEndMs,
  trimRange,
  mode = 'peaks',
  colorWave = '#4a5568',
  colorTrim = 'rgba(100, 108, 255, 0.25)',
  colorPlayhead = '#646cff',
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));

    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.clearRect(0, 0, w, h);

    const {
      durationMs: fullDuration,
      viewStartMs: vStart,
      viewEndMs: vEnd,
      viewDurationMs,
    } = resolveViewRange(durationMs, viewStartMs, viewEndMs);

    const msToX = (ms: number) =>
      Math.round(msToFraction(ms, fullDuration, vStart, vEnd) * w);

    if (trimRange && viewDurationMs > 0) {
      const startX = msToX(trimRange.startMs);
      const endX = msToX(trimRange.endMs);
      ctx.fillStyle = colorTrim;
      ctx.fillRect(
        Math.max(0, startX),
        0,
        Math.max(0, Math.min(w, endX) - Math.max(0, startX)),
        h
      );
    }

    if (peaks && peaks.length > 0 && fullDuration > 0 && viewDurationMs > 0) {
      const totalBuckets = peaks.length / 2;
      const msPerBucket = fullDuration / totalBuckets;
      const startBucket = Math.max(0, Math.floor(vStart / msPerBucket));
      const endBucket = Math.min(totalBuckets, Math.ceil(vEnd / msPerBucket));

      const centerY = h / 2;
      ctx.fillStyle = mode === 'rms' ? 'rgba(255, 193, 7, 0.6)' : colorWave;

      for (let i = startBucket; i < endBucket; i++) {
        const minVal = peaks[i * 2];
        const maxVal = peaks[i * 2 + 1];

        const minNorm = minVal / 32768;
        const maxNorm = maxVal / 32768;

        const minY = centerY - minNorm * centerY;
        const maxY = centerY - maxNorm * centerY;

        const bucketStartMs = i * msPerBucket;
        const bucketEndMs = (i + 1) * msPerBucket;
        const x1 = msToX(bucketStartMs);
        const x2 = msToX(bucketEndMs);
        const barWidth = x2 - x1;

        if (barWidth < 0.5) continue;

        const barHeight = Math.max(1, minY - maxY);
        ctx.fillRect(x1, maxY, Math.max(1, barWidth - 0.5), barHeight);
      }
    }

    if (playheadMs != null && viewDurationMs > 0) {
      const x = msToX(playheadMs);
      if (x >= 0 && x <= w) {
        ctx.strokeStyle = colorPlayhead;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    }
  }, [
    peaks,
    width,
    height,
    playheadMs,
    durationMs,
    viewStartMs,
    viewEndMs,
    trimRange,
    mode,
    colorWave,
    colorTrim,
    colorPlayhead,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width, height }}
      aria-label="오디오 파형"
    />
  );
}

export default WaveformCanvas;
