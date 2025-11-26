import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BaseLayout from './layouts/BaseLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BaseLayout />}>
          <Route index element={<div>홈</div>} />
          <Route path="videos" element={<div>비디오 목록</div>} />
          <Route path="upload" element={<div>비디오 업로드</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;
