import { render, screen } from '@testing-library/react';

import App from '../app/App';

describe('앱 셋업 smoke 테스트', () => {
  it('앱이 정상적으로 렌더링된다', () => {
    render(<App />);
    expect(screen.getByText(/vrew/i)).toBeInTheDocument();
  });

  it('기본 라우팅이 동작해 목록 페이지 타이틀을 노출한다', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /비디오 파이프라인 쇼케이스/i })
    ).toBeInTheDocument();
  });
});
