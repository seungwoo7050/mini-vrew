import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { usePlaybackController } from '@/features/playback/usePlaybackController';

function TestPlayer() {
  const { videoRef, view, actions } = usePlaybackController({
    resetKey: 'k',
    onLoadedMetadata: () => {},
  });

  return (
    <div>
      <video data-testid="video" ref={videoRef} />
      <button data-testid="play" onClick={() => actions.play()}>
        play
      </button>
      <button data-testid="pause" onClick={() => actions.pause()}>
        pause
      </button>
      <button data-testid="toggle" onClick={() => actions.toggle()}>
        toggle
      </button>
      <button data-testid="seek" onClick={() => actions.seek(1200)}>
        seek
      </button>
      <div data-testid="isReady">{String(view.isReady)}</div>
      <div data-testid="isPlaying">{String(view.isPlaying)}</div>
      <div data-testid="time">{String(view.currentTimeMs)}</div>
    </div>
  );
}

describe('usePlaybackController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('becomes ready on loadedmetadata', () => {
    const { getByTestId } = render(<TestPlayer />);
    const video = getByTestId('video') as HTMLVideoElement;

    Object.defineProperty(video, 'duration', { value: 10, writable: true });
    fireEvent(video, new Event('loadedmetadata'));

    expect(getByTestId('isReady').textContent).toBe('true');
    expect(video.duration).toBe(10);
  });

  it('play/pause toggle and seek behavior', async () => {
    const { getByTestId } = render(<TestPlayer />);
    const video = getByTestId('video') as HTMLVideoElement;

    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    const pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {});

    Object.defineProperty(video, 'duration', { value: 30, writable: true });
    fireEvent(video, new Event('loadedmetadata'));

    expect(getByTestId('isReady').textContent).toBe('true');

    fireEvent.click(getByTestId('play'));
    expect(playSpy).toHaveBeenCalled();

    expect(getByTestId('isPlaying').textContent).toBe('true');

    fireEvent(video, new Event('play'));
    expect(getByTestId('isPlaying').textContent).toBe('true');

    fireEvent.click(getByTestId('pause'));
    expect(pauseSpy).toHaveBeenCalled();

    expect(getByTestId('isPlaying').textContent).toBe('false');

    fireEvent(video, new Event('pause'));
    expect(getByTestId('isPlaying').textContent).toBe('false');

    fireEvent.click(getByTestId('seek'));
    expect(Math.round(video.currentTime * 1000)).toBe(1200);
    expect(getByTestId('time').textContent).toBe('1200');

    fireEvent.click(getByTestId('toggle'));
    expect(playSpy).toHaveBeenCalledTimes(2);
  });
});
