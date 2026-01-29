import './polyfills/process';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/global.css';
import { logAppEnvOnce } from '@/config/env';
import { Analytics } from '@vercel/analytics/react';

logAppEnvOnce();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
);
