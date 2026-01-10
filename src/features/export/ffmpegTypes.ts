export type JobId = string;

export type TrimPayload = {
  inputBlob: Blob;
  startMs: number;
  endMs: number;
  outputFormat?: 'mp4' | 'webm';
};

export type BurninPayload = {
  inputBlob: Blob;
  startMs: number;
  endMs: number;
  srtContent: string;
  outputFormat?: 'mp4' | 'webm';
  videoFilter?: string;
};

export type ProbePayload = {
  inputBlob: Blob;
};

export type ProgressData = {
  progress: number;
  processedMs?: number;
  totalMs?: number;
  stage?: string;
};

export type CompletedData = {
  outputBlob: Blob;
  elapsedMs: number;
};

export type ProbeData = {
  durationMs: number;
  width: number;
  height: number;
  codec?: string;
  bitrate?: number;
};

export type FFmpegErrorCode =
  | 'INIT_FAILED'
  | 'INPUT_ERROR'
  | 'OUTPUT_ERROR'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'OUT_OF_MEMORY'
  | 'INVALID_ARGS'
  | 'NOT_READY'
  | 'UNKNOWN';

export type ErrorData = {
  code: FFmpegErrorCode;
  message: string;
  details?: string;
};

export type JobOptions = {
  onProgress?: (progress: ProgressData) => void;
  timeoutMs?: number;
};

export type JobHandle = {
  jobId: JobId;
  cancel: () => void;
};

export type WorkerRequest =
  | { type: 'init' }
  | { type: 'trim'; jobId: JobId; payload: TrimPayload }
  | { type: 'burnin'; jobId: JobId; payload: BurninPayload }
  | { type: 'probe'; jobId: JobId; payload: ProbePayload }
  | { type: 'cancel'; jobId: JobId };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'init-complete'; success: boolean; error?: string }
  | { type: 'progress'; jobId: JobId; data: ProgressData }
  | {
      type: 'completed';
      jobId: JobId;
      data: { outputBuffer: ArrayBuffer; mime: string; elapsedMs: number };
    }
  | { type: 'probe-completed'; jobId: JobId; data: ProbeData }
  | { type: 'error'; jobId: JobId; data: ErrorData }
  | { type: 'cancelled'; jobId: JobId };
