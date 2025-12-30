import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, beforeEach, expect } from 'vitest';

vi.mock('../features/videos/queries', () => ({
  useVideoQuery: vi.fn(),
  useVideoBlobQuery: vi.fn(),
}));

vi.mock('../features/thumbnails/queries', () => ({
  useThumbnailBlobQuery: vi.fn(),
}));

vi.mock('../features/videos/mutations', () => ({
  useDeleteVideoMutation: vi.fn(),
}));

vi.mock('../features/playback/usePlaybackController', () => ({
  usePlaybackController: vi.fn(),
}));

vi.mock('../features/waveform/useWaveformPeaks', () => ({
  useWaveformPeaks: vi.fn(),
}));

vi.mock('../features/playback/useTrimRange', () => ({
  useTrimRange: vi.fn(),
}));

vi.mock('../features/playback/useTrimAuto', () => ({
  useTrimAuto: vi.fn(),
}));

vi.mock('../features/waveform/WaveformCanvas', () => ({
  default: () => <div data-testid="waveform-canvas" />,
}));

vi.mock('../features/waveform/WaveformInteraction', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="waveform-interaction">{children}</div>
  ),
}));

vi.mock('../features/waveform/TrimRangeOverlay', () => ({
  default: () => <div data-testid="trim-overlay" />,
}));

vi.mock('../features/waveform/TrimRecommendationOverlay', () => ({
  default: () => <div data-testid="recommend-overlay" />,
}));

vi.mock('../features/captions/CaptionsPanel', () => ({
  default: () => <div data-testid="captions-panel">captions</div>,
}));

import VideoDetailPage from '../pages/VideoDetailPage';
import { useVideoQuery, useVideoBlobQuery } from '../features/videos/queries';
import { useThumbnailBlobQuery } from '../features/thumbnails/queries';
import { useDeleteVideoMutation } from '../features/videos/mutations';
import { usePlaybackController } from '../features/playback/usePlaybackController';
import { useWaveformPeaks } from '../features/waveform/useWaveformPeaks';
import { useTrimRange } from '../features/playback/useTrimRange';
import { useTrimAuto } from '../features/playback/useTrimAuto';
import { type TrimRecommendation } from '../features/waveform/trimRecommendations';

const mockUseVideoQuery = vi.mocked(useVideoQuery);
const mockUseVideoBlobQuery = vi.mocked(useVideoBlobQuery);
const mockUseThumbnailBlobQuery = vi.mocked(useThumbnailBlobQuery);
const mockUseDeleteVideoMutation = vi.mocked(useDeleteVideoMutation);
const mockUsePlaybackController = vi.mocked(usePlaybackController);
const mockUseWaveformPeaks = vi.mocked(useWaveformPeaks);
const mockUseTrimRange = vi.mocked(useTrimRange);
const mockUseTrimAuto = vi.mocked(useTrimAuto);
type MockTrimAutoReturn = {
  recommendations: TrimRecommendation[];
  activeIndex: number | null;
  activeRecommendation: TrimRecommendation | null;
  message: string | null;
  isGenerating: boolean;
  generate: () => void;
  apply: (index: number) => void;
};

let trimAutoValue: MockTrimAutoReturn;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderPage = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/videos/vid-1']}>
        <Routes>
          <Route path="/videos/:id" element={<VideoDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('VideoDetailPage', () => {
  beforeEach(() => {
    vi.useRealTimers();

    trimAutoValue = {
      recommendations: [
        { startMs: 1000, endMs: 3000, score: 0.8 },
        { startMs: 4000, endMs: 6000, score: 0.5 },
      ],
      activeIndex: 0,
      activeRecommendation: { startMs: 1000, endMs: 3000, score: 0.8 },
      message: '추천 완료',
      isGenerating: false,
      generate: vi.fn(),
      apply: vi.fn(),
    } satisfies MockTrimAutoReturn;

    mockUseVideoQuery.mockReturnValue({
      data: {
        id: 'vid-1',
        title: '테스트 비디오',
        createdAt: new Date('2023-01-01T00:00:00Z').toISOString(),
      },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useVideoQuery>);

    mockUseVideoBlobQuery.mockReturnValue({
      data: new Blob(),
    } as unknown as ReturnType<typeof useVideoBlobQuery>);
    mockUseThumbnailBlobQuery.mockReturnValue({
      data: null,
    } as unknown as ReturnType<typeof useThumbnailBlobQuery>);
    mockUseDeleteVideoMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteVideoMutation>);

    mockUsePlaybackController.mockReturnValue({
      videoRef: vi.fn(),
      view: {
        isReady: true,
        isPlaying: false,
        currentTimeMs: 0,
        durationMs: 60000,
      },
      actions: {
        play: vi.fn(),
        pause: vi.fn(),
        toggle: vi.fn(),
        seek: vi.fn(),
        setLoopRange: vi.fn(),
        setLoopEnabled: vi.fn(),
        setSeekGuardsEnabled: vi.fn(),
      },
    } as unknown as ReturnType<typeof usePlaybackController>);

    mockUseWaveformPeaks.mockReturnValue({
      peaks: new Int16Array([0, 0, 0, 0]),
      isLoading: false,
      error: null,
      progress: 1,
    } as unknown as ReturnType<typeof useWaveformPeaks>);

    mockUseTrimRange.mockReturnValue({
      range: null,
      actions: {
        setRange: vi.fn(),
        setStart: vi.fn(),
        setEnd: vi.fn(),
        clear: vi.fn(),
      },
    } as unknown as ReturnType<typeof useTrimRange>);

    mockUseTrimAuto.mockReturnValue(trimAutoValue);
  });

  it('generates and applies recommendations', () => {
    const utils = renderPage();

    const generateButton = screen.getByRole('button', {
      name: '구간 추천 생성',
    });
    fireEvent.click(generateButton);

    expect(trimAutoValue.generate).toHaveBeenCalledTimes(1);

    const firstRecommendation = screen.getByRole('button', { name: /#1/ });
    fireEvent.click(firstRecommendation);
    expect(trimAutoValue.apply).toHaveBeenCalledWith(0);

    expect(screen.getByText('추천 완료')).toBeInTheDocument();

    utils.unmount();
  });
});
