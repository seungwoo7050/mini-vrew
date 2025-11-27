import { Link } from 'react-router-dom';

import styles from './NotFoundPage.module.css';

function NotFoundPage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>페이지를 찾을 수 없습니다</h1>
      <p className={styles.body}>
        주소를 확인하거나 목록 페이지로 이동해주세요.
      </p>
      <Link to="/videos" className={styles.link}>
        목록으로 돌아가기
      </Link>
    </section>
  );
}

export default NotFoundPage;
