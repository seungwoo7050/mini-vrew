import process from 'process';

if (!globalThis.process) {
  globalThis.process = process as NodeJS.Process;
}

if (!globalThis.process.env) {
  globalThis.process.env = {} as NodeJS.ProcessEnv;
}

if (!globalThis.process.env.NODE_ENV) {
  globalThis.process.env.NODE_ENV = import.meta.env.MODE ?? 'production';
}
