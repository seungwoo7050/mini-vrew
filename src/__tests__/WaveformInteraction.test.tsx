import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import WaveformInteraction from '@/features/waveform/WaveformInteraction';

describe('WaveformInteraction', () => {
  it('maps pointer events to time within view range', () => {
    const onSeek = vi.fn();

    render(
      <WaveformInteraction
        durationMs={4000}
        viewStartMs={1000}
        viewEndMs={3000}
        onSeek={onSeek}
      >
        <div data-testid="child" />
      </WaveformInteraction>
    );

    const slider = screen.getByRole('slider') as HTMLDivElement;
    Object.defineProperty(slider, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 20,
        width: 200,
        height: 20,
      }),
    });

    let captured = false;
    slider.setPointerCapture = vi.fn(() => {
      captured = true;
    });
    slider.releasePointerCapture = vi.fn(() => {
      captured = false;
    });
    slider.hasPointerCapture = vi.fn(() => captured);

    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledWith(2000);

    fireEvent.pointerMove(slider, { clientX: 200, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(3000);

    fireEvent.pointerUp(slider, { pointerId: 1 });
    expect(slider.releasePointerCapture).toHaveBeenCalledWith(1);
  });
});
