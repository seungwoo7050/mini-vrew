import { getAppEnv } from '@/config/env';
import { createLocalAppApi } from './localAppApi';
import type { AppApi } from './AppApi';

const env = getAppEnv();

if (env.apiMode === 'http') {
  console.warn("HTTP API가 아직 구현되지 않아 'local' 모드로 동작합니다.");
}

const appApiInstance: AppApi = createLocalAppApi();

export const appApi = appApiInstance;
