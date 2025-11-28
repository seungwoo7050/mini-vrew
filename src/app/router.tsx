import { Navigate, createBrowserRouter } from 'react-router-dom';

import BaseLayout from './layouts/BaseLayout';
import VideosPage from '@/pages/VideosPage';
import NotFoundPage from '@/pages/NotFoundPage';
import VideoDetailPage from '@/pages/VideoDetailPage';
import UploadPage from '@/pages/UploadPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <BaseLayout />,
    children: [
      { index: true, element: <Navigate to="/videos" replace /> },
      { path: 'videos', element: <VideosPage /> },
      { path: 'videos/:id', element: <VideoDetailPage /> },
      { path: 'upload', element: <UploadPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
