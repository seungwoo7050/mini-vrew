import type { ApiMode } from '@/data/types';

const DEFAULT_API_BASE_URL = '/api';
const DEFAULT_API_MODE: ApiMode = 'local';

function normalizeNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeApiMode(value: string | undefined): ApiMode {
  if (value === 'api' || value === 'http') return 'http';
  if (value === 'local') return 'local';
  return DEFAULT_API_MODE;
}

export type AppEnv = {
  apiBaseUrl: string;
  apiMode: ApiMode;
  raw: {
    VITE_API_BASE_URL: string;
    VITE_API_MODE: string;
  };
};

export function getAppEnv(): AppEnv {
  const rawApiBaseUrl = normalizeNonEmptyString(
    import.meta.env.VITE_API_BASE_URL
  );
  const rawApiMode = normalizeNonEmptyString(import.meta.env.VITE_API_MODE);

  const apiBaseUrl = rawApiBaseUrl ?? DEFAULT_API_BASE_URL;
  const apiMode = normalizeApiMode(rawApiMode);

  return {
    apiBaseUrl,
    apiMode,
    raw: {
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_API_MODE: import.meta.env.VITE_API_MODE,
    },
  };
}

let logged = false;

export function logAppEnvOnce(): void {
  if (!import.meta.env.DEV) return;
  if (logged) return;
  logged = true;

  const env = getAppEnv();

  console.info('[env] DEV mode:', import.meta.env.DEV);
  console.info('[env] raw:', env.raw);
  console.info('[env] resolved:', {
    apiBaseUrl: env.apiBaseUrl,
    apiMode: env.apiMode,
  });
}
