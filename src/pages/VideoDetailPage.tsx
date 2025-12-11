import { Link, useParams } from 'react-router-dom';
import { useVideoQuery } from '@/features/videos/queries';
import CaptionsPanel from '@/features/captions/CaptionsPanel';
import styles from './VideoDetailPage.module.css';

function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const videoId = id ?? '';

  const { data: video, isPending, isError } = useVideoQuery(videoId);

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
      <h1 className={styles.title}>{video.title}</h1>
      <div className={styles.meta}>
        생성: {new Date(video.createdAt).toLocaleString('ko-KR')}
      </div>
      <div className={styles.grid}>
        <article className={styles.panel}>
          <p className={styles.placeholder}>
            비디오/파형/트림/추천/내보내기 섹션이 여기에 배치됩니다.
          </p>
        </article>
        <article className={styles.panel}>
          <CaptionsPanel videoId={videoId} videoTitle={video.title} />
        </article>
      </div>
    </section>
  );
}

export default VideoDetailPage;
