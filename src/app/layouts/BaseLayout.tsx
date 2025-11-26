import { NavLink, Outlet } from 'react-router-dom';

import styles from './BaseLayout.module.css';

const navItems = [
  { to: '/videos', label: '비디오 목록' },
  { to: '/upload', label: '비디오 업로드' },
];

function BaseLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} role="img" aria-label="브랜드 심볼">
            {'V'}
          </span>
          <span className={styles.brandName}>vrew</span>
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
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <span>© 2025 portfolio for frontend.</span>
      </footer>
    </div>
  );
}

export default BaseLayout;
