import type {
  JobId,
  JobOptions,
  ProgressData,
  CompletedData,
  ProbeData,
  ErrorData,
  FFmpegErrorCode,
  TrimPayload,
  BurninPayload,
  ProbePayload,
  WorkerRequest,
  WorkerResponse,
  JobHandle,
} from './ffmpegTypes';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const INIT_TIMEOUT_MS = 30 * 1000;

type ClientState = {
  isInitialized: boolean;
  currentJobId: JobId | null;
  worker: Worker | null;
};

type JobCallbacks = {
  resolve: (data: CompletedData | ProbeData) => void;
  reject: (error: ErrorData) => void;
  onProgress?: (progress: ProgressData) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
};

const state: ClientState = {
  isInitialized: false,
  currentJobId: null,
  worker: null,
};

const jobCallbacks = new Map<JobId, JobCallbacks>();

function generateJobId(): JobId {
  return crypto.randomUUID();
}

function createError(
  code: FFmpegErrorCode,
  message: string,
  details?: string
): ErrorData {
  return { code, message, details };
}

function cleanupJob(jobId: JobId) {
  const cb = jobCallbacks.get(jobId);
  if (cb?.timeoutId) {
    clearTimeout(cb.timeoutId);
  }
  jobCallbacks.delete(jobId);
  if (state.currentJobId === jobId) {
    state.currentJobId = null;
  }
}

function postMessage(msg: WorkerRequest) {
  if (!state.worker) {
    throw new Error('Worker not initialized');
  }
  state.worker.postMessage(msg);
}

function handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
  const msg = event.data;
  console.log('[ffmpeg.client] Received worker message:', msg);

  switch (msg.type) {
    case 'ready':
    case 'init-complete':
      break;
    case 'progress': {
      const cb = jobCallbacks.get(msg.jobId);
      cb?.onProgress?.(msg.data);
      break;
    }
    case 'completed': {
      const outputBlob = new Blob([msg.data.outputBuffer], {
        type: msg.data.mime,
      });
      const completedData: CompletedData = {
        outputBlob,
        elapsedMs: msg.data.elapsedMs,
      };
      const cb = jobCallbacks.get(msg.jobId);
      if (cb) {
        cb.resolve(completedData);
        cleanupJob(msg.jobId);
      }
      break;
    }
    case 'probe-completed': {
      const cb = jobCallbacks.get(msg.jobId);
      if (cb) {
        cb.resolve(msg.data);
        cleanupJob(msg.jobId);
      }
      break;
    }
    case 'error': {
      const cb = jobCallbacks.get(msg.jobId);
      if (cb) {
        cb.reject(msg.data);
        cleanupJob(msg.jobId);
      }
      break;
    }
    case 'cancelled': {
      const cb = jobCallbacks.get(msg.jobId);
      if (cb) {
        cb.reject(createError('CANCELLED', 'Job was cancelled'));
        cleanupJob(msg.jobId);
      }
      break;
    }
  }
}

function handleWorkerError(event: ErrorEvent) {
  console.error('[FFmpegClient] Worker error:', event.message);
  for (const [jobId, cb] of jobCallbacks) {
    cb.reject(createError('UNKNOWN', 'Worker crashed', event.message));
    cleanupJob(jobId);
  }
  state.isInitialized = false;
  state.worker = null;
}

export async function initFFmpegWorker(): Promise<void> {
  console.log('[ffmpeg.client] initFFmpegWorker called');
  if (state.isInitialized && state.worker) {
    console.log('[ffmpeg.client] Worker already initialized');
    return;
  }

  if (state.worker) {
    console.log('[ffmpeg.client] Terminating existing worker');
    state.worker.terminate();
    state.worker = null;
  }

  console.log('[ffmpeg.client] Creating new worker');
  return new Promise((resolve, reject) => {
    const workerUrl = new URL('./ffmpeg.worker.ts', import.meta.url);
    console.log('[ffmpeg.client] Worker URL:', workerUrl.href);
    const worker = new Worker(workerUrl, { type: 'module' });

    const timeoutId = setTimeout(() => {
      console.error('[ffmpeg.client] Worker initialization timeout');
      worker.terminate();
      reject(createError('TIMEOUT', 'Worker initialization timeout'));
    }, INIT_TIMEOUT_MS);

    const initHandler = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      console.log('[ffmpeg.client] Received init message:', msg);

      if (
        msg.type === 'ready' ||
        (msg.type === 'init-complete' && msg.success)
      ) {
        console.log('[ffmpeg.client] Worker initialized successfully');
        clearTimeout(timeoutId);
        worker.removeEventListener('message', initHandler);
        worker.addEventListener('message', handleWorkerMessage);
        worker.addEventListener('error', handleWorkerError);
        state.worker = worker;
        state.isInitialized = true;
        resolve();
      } else if (msg.type === 'init-complete' && !msg.success) {
        console.error('[ffmpeg.client] Worker init failed:', msg.error);
        clearTimeout(timeoutId);
        worker.terminate();
        reject(createError('INIT_FAILED', msg.error ?? 'Worker init failed'));
      }
    };

    worker.addEventListener('message', initHandler);
    console.log('[ffmpeg.client] Sending init message to worker');
    worker.postMessage({ type: 'init' });
  });
}

export function terminateFFmpegWorker(): void {
  for (const [jobId, cb] of jobCallbacks) {
    cb.reject(createError('CANCELLED', 'Worker terminated'));
    cleanupJob(jobId);
  }

  if (state.worker) {
    state.worker.terminate();
    state.worker = null;
  }

  state.isInitialized = false;
  state.currentJobId = null;
}

export function isFFmpegReady(): boolean {
  return state.isInitialized && state.worker !== null;
}

export function isJobRunning(): boolean {
  return state.currentJobId !== null;
}

async function startJob<T extends CompletedData | ProbeData>(
  type: 'trim' | 'burnin' | 'probe',
  payload: TrimPayload | BurninPayload | ProbePayload,
  options: JobOptions = {}
): Promise<T> {
  if (!state.isInitialized || !state.worker) {
    throw createError(
      'NOT_READY',
      'FFmpeg worker not initialized. Call initFFmpegWorker() first.'
    );
  }

  if (state.currentJobId !== null) {
    throw createError(
      'INVALID_ARGS',
      'Another job is running. Wait or cancel first.'
    );
  }

  const jobId = generateJobId();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanupJob(jobId);
      reject(
        createError(
          'TIMEOUT',
          `Job timed out after ${timeoutMs / 1000} seconds.`
        )
      );
      postMessage({ type: 'cancel', jobId });
    }, timeoutMs);

    jobCallbacks.set(jobId, {
      resolve: resolve as (data: CompletedData | ProbeData) => void,
      reject,
      onProgress: options.onProgress,
      timeoutId,
    });

    state.currentJobId = jobId;

    postMessage({
      type,
      jobId,
      payload,
    } as WorkerRequest);
  });
}

export async function trimVideo(
  payload: TrimPayload,
  options: JobOptions = {}
): Promise<CompletedData> {
  return startJob<CompletedData>('trim', payload, options);
}

export async function exportWithSubtitles(
  payload: BurninPayload,
  options: JobOptions = {}
): Promise<CompletedData> {
  return startJob<CompletedData>('burnin', payload, options);
}

export async function probeVideo(
  payload: ProbePayload,
  options: Omit<JobOptions, 'onProgress'> = {}
): Promise<ProbeData> {
  return startJob<ProbeData>('probe', payload, options);
}

export function cancelCurrentJob(): void {
  if (state.currentJobId && state.worker) {
    postMessage({ type: 'cancel', jobId: state.currentJobId });
  }
}

export function startExportWithHandle(
  payload: BurninPayload,
  options: JobOptions = {}
): JobHandle & { promise: Promise<CompletedData> } {
  const jobId = generateJobId();

  const promise = new Promise<CompletedData>((resolve, reject) => {
    if (!state.isInitialized || !state.worker) {
      reject(createError('NOT_READY', 'FFmpeg worker not initialized.'));
      return;
    }
    if (state.currentJobId !== null) {
      reject(createError('INVALID_ARGS', 'Another job is running.'));
      return;
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
      cleanupJob(jobId);
      reject(createError('TIMEOUT', `Job timed out.`));
      postMessage({ type: 'cancel', jobId });
    }, timeoutMs);

    jobCallbacks.set(jobId, {
      resolve: resolve as (data: CompletedData | ProbeData) => void,
      reject,
      onProgress: options.onProgress,
      timeoutId,
    });

    state.currentJobId = jobId;

    postMessage({
      type: 'burnin',
      jobId,
      payload,
    });
  });

  return {
    jobId,
    cancel: () => {
      if (state.worker) {
        postMessage({ type: 'cancel', jobId });
      }
    },
    promise,
  };
}
