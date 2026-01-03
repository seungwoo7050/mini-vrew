import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useVideoBlobQuery, useVideoQuery } from '@/features/videos/queries';
import CaptionsPanel from '@/features/captions/CaptionsPanel';
import SubtitleOverlay from '@/features/captions/SubtitleOverlay';
import { useCaptionsQuery } from '@/features/captions/queries';
import { useThumbnailBlobQuery } from '@/features/thumbnails/queries';
import { useDeleteVideoMutation } from '@/features/videos/mutations';
import { usePlaybackController } from '@/features/playback/usePlaybackController';
import { useWaveformPeaks } from '@/features/waveform/useWaveformPeaks';
import WaveformCanvas from '@/features/waveform/WaveformCanvas';
import WaveformInteraction from '@/features/waveform/WaveformInteraction';
import TrimRangeOverlay from '@/features/waveform/TrimRangeOverlay';
import { useTrimRange } from '@/features/playback/useTrimRange';
import TrimRecommendationOverlay from '@/features/waveform/TrimRecommendationOverlay';
import { useTrimAuto } from '@/features/playback/useTrimAuto';
import {
  type RecommendationMode,
  type TrimRecommendation,
} from '@/features/waveform/trimRecommendations';
import styles from './VideoDetailPage.module.css';

function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const videoId = id ?? '';
  const navigate = useNavigate();

  const { data: video, isPending, isError } = useVideoQuery(videoId);
  const { data: videoBlob } = useVideoBlobQuery(videoId);
  const { data: thumbnailBlob } = useThumbnailBlobQuery(videoId);
  const { data: captions = [] } = useCaptionsQuery(videoId);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [isThumbnailCollapsed, setIsThumbnailCollapsed] = useState(false);
  const deleteVideo = useDeleteVideoMutation();
  const [error, setError] = useState<string | null>(null);
  const [isTrimGuardEnabled, setIsTrimGuardEnabled] = useState(false);
  const [recommendMode, setRecommendMode] =
    useState<RecommendationMode>('highlight');
  const [recommendCount, setRecommendCount] = useState(2);
  const waveformWrapperRef = useRef<HTMLDivElement | null>(null);
  const [waveformWidth, setWaveformWidth] = useState(0);

  const videoUrl = useMemo(() => {
    if (!videoBlob) return null;
    return URL.createObjectURL(videoBlob);
  }, [videoBlob]);

  const thumbnailUrl = useMemo(() => {
    if (!thumbnailBlob) return null;
    return URL.createObjectURL(thumbnailBlob);
  }, [thumbnailBlob]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
  }, [videoUrl, thumbnailUrl]);

  const {
    videoRef: playerRef,
    view: playerView,
    actions: playerActions,
  } = usePlaybackController({
    resetKey: videoId,
    onLoadedMetadata: useCallback(() => {}, []),
  });

  const handleVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      playerRef(el);
      setVideoEl(el);
    },
    [playerRef]
  );

  const waveform = useWaveformPeaks({
    videoBlob: videoBlob ?? null,
    bucketCount: 600,
  });

  useEffect(() => {
    const el = waveformWrapperRef.current;
    if (!el) return;

    const updateWidth = () => {
      const nextWidth = el.clientWidth;
      setWaveformWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(el);
    return () => observer.disconnect();
  }, [waveform.isLoading]);
  const trim = useTrimRange(playerView.durationMs);

  const recommendationSegmentMs = useMemo(() => {
    if (!playerView.durationMs || playerView.durationMs <= 0) {
      return 4000;
    }
    const rough = Math.round(playerView.durationMs / 6);
    return Math.max(1000, Math.min(8000, rough));
  }, [playerView.durationMs]);

  const maxRecommendCount = useMemo(() => {
    if (!playerView.durationMs || playerView.durationMs <= 0) return 1;
    const approx = Math.max(
      1,
      Math.floor(playerView.durationMs / recommendationSegmentMs)
    );
    return Math.max(1, Math.min(5, approx));
  }, [playerView.durationMs, recommendationSegmentMs]);

  useEffect(() => {
    setRecommendCount((prev) => Math.min(Math.max(1, prev), maxRecommendCount));
  }, [maxRecommendCount]);

  const {
    recommendations,
    activeIndex: activeRecommendationIndex,
    message: recommendMessage,
    isGenerating: isRecommendationGenerating,
    generate: generateRecommendations,
    apply: applyRecommendationAt,
  } = useTrimAuto({
    peaks: waveform.peaks,
    durationMs: playerView.durationMs,
    mode: recommendMode,
    count: recommendCount,
    targetSegmentMs: recommendationSegmentMs,
    onApply: (range, meta) => applyRecommendation(range, meta.autoEnableGuard),
  });

  const handleDelete = async () => {
    setError(null);
    if (!window.confirm('이 비디오를 삭제할까요?')) return;
    if (!video) return;
    try {
      await deleteVideo.mutateAsync(video.id);
      navigate('/videos', { replace: true });
    } catch {
      setError('비디오 삭제 중 오류가 발생했습니다.');
    }
  };

  const formatTime = useCallback((ms: number | null | undefined) => {
    if (ms == null || Number.isNaN(ms)) return '0:00';
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleSeek = useCallback(
    (timeMs: number) => {
      playerActions.seek(timeMs);
    },
    [playerActions]
  );

  const preservePlayback = useCallback(
    (fn: () => void) => {
      const wasPlaying = playerView.isPlaying;
      fn();
      if (wasPlaying) {
        playerActions.play();
      }
    },
    [playerActions, playerView.isPlaying]
  );

  const handleSetTrimStart = useCallback(() => {
    preservePlayback(() => trim.actions.setStart(playerView.currentTimeMs));
  }, [preservePlayback, trim.actions, playerView.currentTimeMs]);

  const handleSetTrimEnd = useCallback(() => {
    preservePlayback(() => trim.actions.setEnd(playerView.currentTimeMs));
  }, [preservePlayback, trim.actions, playerView.currentTimeMs]);

  const handleClearTrim = useCallback(() => {
    preservePlayback(() => trim.actions.clear());
  }, [preservePlayback, trim.actions]);

  const handleChangeTrimStart = useCallback(
    (ms: number) => preservePlayback(() => trim.actions.setStart(ms)),
    [preservePlayback, trim.actions]
  );

  const handleChangeTrimEnd = useCallback(
    (ms: number) => preservePlayback(() => trim.actions.setEnd(ms)),
    [preservePlayback, trim.actions]
  );

  const handleChangeTrimRange = useCallback(
    (startMs: number, endMs: number) =>
      preservePlayback(() => trim.actions.setRange(startMs, endMs)),
    [preservePlayback, trim.actions]
  );

  const syncGuardForRange = useCallback(
    (
      range: TrimRecommendation | { startMs: number; endMs: number } | null,
      autoEnable = false
    ) => {
      const enableGuard = autoEnable || isTrimGuardEnabled;
      if (!range) {
        playerActions.setSeekGuardsEnabled(false);
        playerActions.setLoopEnabled(false);
        playerActions.setLoopRange(null);
        return enableGuard;
      }

      playerActions.setSeekGuardsEnabled(enableGuard);
      playerActions.setLoopEnabled(enableGuard);
      playerActions.setLoopRange(enableGuard ? range : null);
      return enableGuard;
    },
    [isTrimGuardEnabled, playerActions]
  );

  const applyRecommendation = useCallback(
    (range: TrimRecommendation, autoEnableGuard = false) => {
      preservePlayback(() => {
        trim.actions.setRange(range.startMs, range.endMs);
        if (autoEnableGuard) {
          setIsTrimGuardEnabled(true);
        }
        const enabled = syncGuardForRange(range, autoEnableGuard);
        if (
          enabled &&
          (playerView.currentTimeMs < range.startMs ||
            playerView.currentTimeMs > range.endMs)
        ) {
          playerActions.seek(range.startMs);
        }
      });
    },
    [
      preservePlayback,
      trim.actions,
      syncGuardForRange,
      playerActions,
      playerView.currentTimeMs,
    ]
  );

  const handleGenerateRecommendations = useCallback(() => {
    generateRecommendations();
  }, [generateRecommendations]);

  useEffect(() => {
    const enabled = syncGuardForRange(trim.range, false);
    if (enabled && trim.range) {
      const { startMs, endMs } = trim.range;
      if (
        playerView.currentTimeMs < startMs ||
        playerView.currentTimeMs > endMs
      ) {
        playerActions.seek(startMs);
      }
    }
  }, [
    isTrimGuardEnabled,
    trim.range,
    playerActions,
    playerView.currentTimeMs,
    syncGuardForRange,
  ]);

  useEffect(() => {
    if (!trim.range && isTrimGuardEnabled) {
      setIsTrimGuardEnabled(false);
    }
  }, [trim.range, isTrimGuardEnabled]);

  const handleToggleTrimGuard = useCallback(() => {
    if (!trim.range) {
      setIsTrimGuardEnabled(false);
      return;
    }
    setIsTrimGuardEnabled((prev) => !prev);
  }, [trim.range]);

  if (!videoId) {
    return (
      <p className={styles.status}>
        잘못된 경로입니다.
        <br />
        <br />
        목록에서 비디오를 선택하세요.
      </p>
    );
  }

  if (isPending) {
    return <p className={styles.status}>비디오 정보를 불러오는 중...</p>;
  }

  if (isError) {
    return (
      <p className={styles.status}>
        비디오 정보를 불러오지 못했습니다.
        <br />
        <br />
        잠시 후 다시 시도해주세요.
      </p>
    );
  }

  if (!video) {
    return (
      <p className={styles.status}>
        비디오를 찾을 수 없습니다.
        <br />
        <br />
        <Link to="/videos" className={styles.link}>
          비디오 목록으로 돌아가기
        </Link>
      </p>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>{video.title}</h1>
          <div className={styles.meta}>
            생성: {new Date(video.createdAt).toLocaleString('ko-KR')}
          </div>
        </div>
        <button
          className={styles.deleteButton}
          type="button"
          onClick={handleDelete}
          disabled={deleteVideo.isPending}
        >
          {deleteVideo.isPending ? '삭제 중...' : '삭제'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.grid}>
        <article className={styles.panel}>
          <div>
            <div className={styles.player}>
              {videoUrl ? (
                <>
                  <video
                    ref={handleVideoRef}
                    src={videoUrl}
                    poster={thumbnailUrl ?? undefined}
                    playsInline
                    controls
                    className={styles.playerVideo}
                    data-testid="video-element"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        e.preventDefault();
                        e.stopPropagation();
                        playerActions.toggle();
                      }
                    }}
                  />
                  <SubtitleOverlay
                    captions={captions}
                    currentTimeMs={playerView.currentTimeMs}
                    onWordClick={handleSeek}
                  />
                </>
              ) : (
                <div
                  style={{
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  비디오 로딩 중...
                </div>
              )}
            </div>

            <div className={styles.waveformSection}>
              <div className={styles.waveformHeader}>
                <h2 className={styles.sectionTitle}>파형</h2>
                <div className={styles.timeDisplay}>
                  {formatTime(playerView.currentTimeMs)} /{' '}
                  {formatTime(playerView.durationMs)}
                </div>
              </div>

              {waveform.isLoading ? (
                <p className={styles.waveformStatus}>
                  파형 분석 중... {Math.round(waveform.progress * 100)}%
                </p>
              ) : waveform.error ? (
                <p className={styles.waveformError}>{waveform.error}</p>
              ) : (
                <div
                  className={styles.waveformWrapper}
                  ref={waveformWrapperRef}
                >
                  <WaveformInteraction
                    durationMs={playerView.durationMs}
                    onSeek={handleSeek}
                    viewStartMs={null}
                    viewEndMs={null}
                    className={styles.waveformContainer}
                  >
                    <WaveformCanvas
                      peaks={waveform.peaks}
                      width={waveformWidth || 1}
                      height={120}
                      playheadMs={playerView.currentTimeMs}
                      durationMs={playerView.durationMs ?? undefined}
                      trimRange={trim.range}
                    />
                  </WaveformInteraction>
                  <TrimRecommendationOverlay
                    recommendations={recommendations}
                    durationMs={playerView.durationMs}
                    activeIndex={activeRecommendationIndex}
                    onSelect={applyRecommendationAt}
                  />
                  {trim.range &&
                    playerView.durationMs &&
                    playerView.durationMs > 0 && (
                      <TrimRangeOverlay
                        range={trim.range}
                        durationMs={playerView.durationMs}
                        onChangeStart={handleChangeTrimStart}
                        onChangeEnd={handleChangeTrimEnd}
                        onChangeRange={handleChangeTrimRange}
                      />
                    )}
                </div>
              )}

              <div className={styles.trimControls}>
                <button
                  type="button"
                  className={styles.trimButton}
                  onClick={handleSetTrimStart}
                >
                  시작점 설정
                </button>
                <button
                  type="button"
                  className={styles.trimButton}
                  onClick={handleSetTrimEnd}
                >
                  종료점 설정
                </button>
                <button
                  type="button"
                  className={styles.trimButton}
                  onClick={handleClearTrim}
                >
                  초기화
                </button>
                <label className={styles.trimToggle}>
                  <input
                    type="checkbox"
                    checked={isTrimGuardEnabled && Boolean(trim.range)}
                    onChange={handleToggleTrimGuard}
                    disabled={!trim.range}
                  />
                  트림 구간 활성화
                </label>
              </div>
              <div className={styles.recommendSection}>
                <div className={styles.recommendRow}>
                  <div className={styles.recommendOptionGroup}>
                    <span className={styles.recommendLabel}>추천 대상</span>
                    <label className={styles.recommendRadio}>
                      <input
                        type="radio"
                        name="recommend-mode"
                        value="highlight"
                        checked={recommendMode === 'highlight'}
                        onChange={() => setRecommendMode('highlight')}
                      />
                      하이라이트
                    </label>
                    <label className={styles.recommendRadio}>
                      <input
                        type="radio"
                        name="recommend-mode"
                        value="remove"
                        checked={recommendMode === 'remove'}
                        onChange={() => setRecommendMode('remove')}
                      />
                      삭제 후보
                    </label>
                  </div>
                  <label className={styles.recommendCount}>
                    추천 개수
                    <select
                      value={recommendCount}
                      onChange={(e) =>
                        setRecommendCount(Number.parseInt(e.target.value, 10))
                      }
                    >
                      {Array.from(
                        { length: maxRecommendCount },
                        (_, i) => i + 1
                      ).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.recommendButton}
                    onClick={handleGenerateRecommendations}
                    disabled={
                      waveform.isLoading ||
                      !playerView.durationMs ||
                      isRecommendationGenerating
                    }
                  >
                    {isRecommendationGenerating
                      ? '생성 중...'
                      : '구간 추천 생성'}
                  </button>
                </div>
                {recommendMessage && (
                  <p className={styles.recommendStatus}>{recommendMessage}</p>
                )}
                {recommendations.length > 0 && (
                  <div className={styles.recommendList}>
                    {recommendations.map((rec, idx) => (
                      <button
                        key={`${rec.startMs}-${rec.endMs}-${idx}`}
                        type="button"
                        className={`${styles.recommendItem} ${
                          idx === activeRecommendationIndex
                            ? styles.recommendItemActive
                            : ''
                        }`}
                        onClick={() => applyRecommendationAt(idx)}
                      >
                        #{idx + 1} {formatTime(rec.startMs)} ~{' '}
                        {formatTime(rec.endMs)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {trim.range && (
                <p className={styles.trimInfo}>
                  구간: {formatTime(trim.range.startMs)} ~{' '}
                  {formatTime(trim.range.endMs)}
                  {'  '}({formatTime(trim.range.endMs - trim.range.startMs)})
                </p>
              )}
            </div>

            <div className={styles.thumbBlock}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>썸네일</h2>
                <button
                  type="button"
                  onClick={() => setIsThumbnailCollapsed(!isThumbnailCollapsed)}
                  className={styles.toggleButton}
                >
                  {isThumbnailCollapsed ? '펼치기' : '접기'}
                </button>
              </div>
              {!isThumbnailCollapsed && (
                <div className={styles.thumbWrapper} aria-label="썸네일">
                  {thumbnailUrl ? (
                    <img
                      className={styles.thumbImage}
                      src={thumbnailUrl}
                      alt={`${video.title} 썸네일`}
                    />
                  ) : (
                    <div className={styles.thumbFallback}>썸네일 없음</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </article>
        <article className={`${styles.panel} ${styles.captionColumn}`}>
          <CaptionsPanel videoId={videoId} videoTitle={video.title} />
        </article>
      </div>
    </section>
  );
}

export default VideoDetailPage;
