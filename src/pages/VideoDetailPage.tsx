import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useVideoBlobQuery, useVideoQuery } from '@/features/videos/queries';
import CaptionsPanel from '@/features/captions/CaptionsPanel';
import { useThumbnailBlobQuery } from '@/features/thumbnails/queries';
import { useDeleteVideoMutation } from '@/features/videos/mutations';
import { usePlaybackController } from '@/features/playback/usePlaybackController';
import styles from './VideoDetailPage.module.css';

function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const videoId = id ?? '';
  const navigate = useNavigate();

  const { data: video, isPending, isError } = useVideoQuery(videoId);
  const { data: videoBlob } = useVideoBlobQuery(videoId);
  const { data: thumbnailBlob } = useThumbnailBlobQuery(videoId);
  const [isThumbnailCollapsed, setIsThumbnailCollapsed] = useState(false);
  const deleteVideo = useDeleteVideoMutation();
  const [error, setError] = useState<string | null>(null);

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

  const { videoRef: playerRef, actions: playerActions } = usePlaybackController(
    {
      resetKey: videoId,
      onLoadedMetadata: useCallback(() => {}, []),
    }
  );

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
                <video
                  ref={playerRef}
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
