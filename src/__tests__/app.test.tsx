import { render, screen } from '@testing-library/react';

import App from '../app/App';

describe('앱 셋업 smoke 테스트', () => {
  it('앱이 정상적으로 렌더링된다', () => {
    render(<App />);
    expect(screen.getByText(/vrew/i)).toBeInTheDocument();
  });
});
