import { Link } from 'react-router-dom';
import { useVideosQuery } from '@/features/videos/queries';
import styles from './VideosPage.module.css';

function VideosPage() {
  const { data, isPending, isError } = useVideosQuery();
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
            <article key={video.id} className={styles.card}>
              <h2 className={styles.videoTitle}>{video.title}</h2>
              <p className={styles.placeholder}>
                생성: {new Date(video.createdAt).toLocaleString('ko-KR')}
              </p>
              <Link
                className={styles.link}
                to={`/videos/${video.id}`}
                aria-label={`${video.title} 상세 보기`}
              >
                상세 보기 ➡️
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default VideosPage;
