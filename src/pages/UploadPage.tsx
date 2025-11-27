import styles from './UploadPage.module.css';

function UploadPage() {
  return (
    <section className={styles.page}>
      <div>
        <h1 className={styles.title}>비디오 업로드</h1>
        <p className={styles.subtitle}>
          로컬 비디오를 업로드하고 IndexedDB에 안전하게 저장합니다.
        </p>
      </div>
      <div className={styles.steps}>
        <span>1) 제목과 파일을 선택합니다.</span>
        <span>2) 썸네일을 생성해 미리 봅니다.</span>
        <span>3) 업로드 후 목록에서 바로 확인합니다.</span>
      </div>
      <p className={styles.placeholder}>
        구현 단계에서 업로드 폼과 진행 상태가 여기에 배치됩니다.
      </p>
    </section>
  );
}

export default UploadPage;
