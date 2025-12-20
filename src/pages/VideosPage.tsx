import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useVideosQuery } from '@/features/videos/queries';
import { useThumbnailBlobQuery } from '@/features/thumbnails/queries';
import { useDeleteVideoMutation } from '@/features/videos/mutations';
import styles from './VideosPage.module.css';

function Thumbnail({ videoId, title }: { videoId: string; title: string }) {
  const { data: blob } = useThumbnailBlobQuery(videoId);

  const url = useMemo(() => {
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <div className={styles.thumbWrapper} aria-label="썸네일">
      {url ? (
        <img className={styles.thumbImage} src={url} alt={`${title} 썸네일`} />
      ) : (
        <div className={styles.thumbFallback}>썸네일 없음</div>
      )}
    </div>
  );
}

function VideosPage() {
  const { data, isPending, isError } = useVideosQuery();
  const deleteVideo = useDeleteVideoMutation();
  const videos = data ?? [];

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>비디오 목록</h1>
        <span className={styles.meta}>모든 파이프라인의 시작점</span>
      </div>

      {isPending && <p className={styles.status}>목록을 불러오는 중...</p>}
      {isError && (
        <p className={styles.status}>
          목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      )}

      {!isPending && !isError && videos.length === 0 && (
        <p className={styles.status}>
          아직 업로드된 비디오가 없습니다. 업로드 후 여기에 표시됩니다.
        </p>
      )}

      {!isPending && !isError && videos.length > 0 && (
        <div className={styles.grid}>
          {videos.map((video) => (
            <Link
              key={video.id}
              to={`/videos/${video.id}`}
              className={styles.cardLink}
            >
              <article className={styles.card}>
                <Thumbnail videoId={video.id} title={video.title} />
                <p className={styles.placeholder}>
                  생성: {new Date(video.createdAt).toLocaleString('ko-KR')}
                </p>
                <h2 className={styles.videoTitle}>{video.title}</h2>
                <button
                  className={styles.deleteButton}
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!window.confirm('이 비디오를 삭제할까요?')) return;
                    try {
                      await deleteVideo.mutateAsync(video.id);
                    } catch {
                      // ignore
                    }
                  }}
                  disabled={deleteVideo.isPending}
                >
                  {deleteVideo.isPending ? '삭제 중...' : '삭제'}
                </button>
              </article>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default VideosPage;
