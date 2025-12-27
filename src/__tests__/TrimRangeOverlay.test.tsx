import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import TrimRangeOverlay from '@/features/waveform/TrimRangeOverlay';

const createRect = (width = 200) => ({
  left: 0,
  top: 0,
  right: width,
  bottom: 20,
  width,
  height: 20,
});

describe('TrimRangeOverlay', () => {
  it('maps pointer drag to view range time', () => {
    const onChangeStart = vi.fn();
    const onChangeEnd = vi.fn();
    const onChangeRange = vi.fn();

    const { container } = render(
      <TrimRangeOverlay
        range={{ startMs: 1000, endMs: 3000 }}
        durationMs={4000}
        viewStartMs={1000}
        viewEndMs={3000}
        onChangeStart={onChangeStart}
        onChangeEnd={onChangeEnd}
        onChangeRange={onChangeRange}
      />
    );

    const overlay = container.firstChild as HTMLDivElement;
    Object.defineProperty(overlay, 'getBoundingClientRect', {
      value: () => createRect(200),
    });

    const startHandle = screen.getByTestId(
      'trim-handle-start'
    ) as HTMLDivElement;

    let captured = false;
    startHandle.setPointerCapture = vi.fn(() => {
      captured = true;
    });
    startHandle.releasePointerCapture = vi.fn(() => {
      captured = false;
    });
    startHandle.hasPointerCapture = vi.fn(() => captured);

    fireEvent.pointerDown(startHandle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(startHandle, { clientX: 100, pointerId: 1 });

    expect(onChangeStart).toHaveBeenCalled();
    const calledWith = onChangeStart.mock.calls[0]?.[0];
    expect(calledWith).toBe(2000);

    fireEvent.pointerUp(startHandle, { pointerId: 1 });
  });
});
