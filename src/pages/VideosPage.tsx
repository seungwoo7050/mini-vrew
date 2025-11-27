import styles from './VideosPage.module.css';

function VideosPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>비디오 목록</h1>
        <span className={styles.meta}>
          업로드 ➡️ 비디오 목록 ➡️ 편집 ➡️ 내보내기 파이프라인
        </span>
      </div>
      <div className={styles.grid}>
        <article className={styles.card}>
          <p className={styles.placeholder}>
            업로드된 비디오가 여기에 카드 형태로 표시됩니다.
          </p>
        </article>
        <article className={styles.card}>
          <p className={styles.placeholder}>
            썸네일과 메타데이터, 최근 편집 정보가 노출됩니다.
          </p>
        </article>
      </div>
    </section>
  );
}

export default VideosPage;
