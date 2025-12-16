import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import UploadPage from '@/pages/UploadPage';

describe('업로드 플로우', () => {
  function renderWithQuery(ui: React.ReactElement) {
    const client = new QueryClient();
    return render(
      <MemoryRouter>
        <QueryClientProvider client={client}>{ui}</QueryClientProvider>
      </MemoryRouter>
    );
  }

  it('제목과 파일을 입력해 업로드를 완료한다', async () => {
    renderWithQuery(<UploadPage />);

    const titleInput = screen.getByPlaceholderText(
      '예) 취업을 위한 프로젝트 소개 영상'
    );
    const fileInput = screen.getByLabelText('비디오 파일');
    const file = new File(['dummy'], 'sample.mp4', { type: 'video/mp4' });

    fireEvent.change(titleInput, { target: { value: '샘플 업로드' } });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /업로드/ }));

    await waitFor(() => {
      expect(screen.getByText(/업로드 완료/)).toBeInTheDocument();
    });
  });
});
