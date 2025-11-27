import styles from './VideoDetailPage.module.css';

function VideoDetailPage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>비디오 편집</h1>
      <div className={styles.grid}>
        <article className={styles.panel}>
          <p className={styles.placeholder}>
            비디오/파형/트림/추천/내보내기 섹션이 여기에 배치됩니다.
          </p>
        </article>
        <article className={styles.panel}>
          <p className={styles.placeholder}>
            자막 편집, 메타데이터, 상태 패널이 여기에 배치됩니다.
          </p>
        </article>
      </div>
    </section>
  );
}

export default VideoDetailPage;
