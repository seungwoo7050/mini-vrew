import { NavLink, Outlet } from 'react-router-dom';

import styles from './BaseLayout.module.css';

const navItems = [{ to: '/videos', label: '비디오 목록' }];

function BaseLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <span className={styles.logo} role="img" aria-label="브랜드 심볼">
              {'V'}
            </span>
            <div>
              <span className={styles.brandName}>vrew</span>
              <span className={styles.brandTagline}>
                비디오 편집 파이프라인 포트폴리오
              </span>
            </div>
          </div>
          <nav className={styles.nav} aria-label="주요 탐색">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? styles.linkActive : styles.link
                }
                aria-label={`${item.label} 페이지로 이동`}
                end
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <NavLink to="/upload" className={styles.cta}>
            새 프로젝트 업로드
          </NavLink>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <span>© 2026 portfolio for frontend.</span>
      </footer>
    </div>
  );
}

export default BaseLayout;
