import styles from './App.module.css';

function App() {
  return (
    <main className={styles.container}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>vrew</p>
        <h1 className={styles.title}>로컬 전용 웹 비디오 편집기</h1>
        <p className={styles.body}>
          업로드 ➡️ 목록 ➡️ 편집 ➡️ 내보내기 파이프라인을 FSD-lite 구조로
          구현하며, 로컬 실행을 위한 API 경계를 명확히 유지합니다.
        </p>
        <ul className={styles.list}>
          <li>AppApi 경계와 로컬 구현</li>
          <li>IndexedDB 지속성과 워커 기반 내보내기 경계를 분리</li>
          <li>접근성 및 반응성 기본값을 갖춘 한국어 UI</li>
        </ul>
        <p className={styles.note}>
          다음 커밋부터 순차적으로 구현을 진행합니다.
        </p>
      </section>
    </main>
  );
}

export default App;
