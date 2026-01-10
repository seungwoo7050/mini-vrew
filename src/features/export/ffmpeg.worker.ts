import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

import type {
  JobId,
  ProgressData,
  ProbeData,
  TrimPayload,
  BurninPayload,
  ProbePayload,
  WorkerRequest,
  WorkerResponse,
  FFmpegErrorCode,
} from './ffmpegTypes';

declare const self: Worker & typeof globalThis;

let ffmpeg: FFmpeg | null = null;
let currentJobId: JobId | null = null;
let cancelRequested = false;

const CORE_JS_URL =
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js';
const CORE_WASM_URL =
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm';

function post(message: WorkerResponse, transfer?: Transferable[]) {
  if (transfer) {
    self.postMessage(message, transfer);
  } else {
    self.postMessage(message);
  }
}

function sendProgress(jobId: JobId, data: ProgressData) {
  post({ type: 'progress', jobId, data });
}

function sendCompleted(
  jobId: JobId,
  outputBuffer: ArrayBuffer,
  mime: string,
  elapsedMs: number
) {
  post({ type: 'completed', jobId, data: { outputBuffer, mime, elapsedMs } }, [
    outputBuffer,
  ]);
}

function sendProbe(jobId: JobId, data: ProbeData) {
  post({ type: 'probe-completed', jobId, data });
}

function sendError(
  jobId: JobId,
  code: FFmpegErrorCode,
  message: string,
  details?: string
) {
  post({ type: 'error', jobId, data: { code, message, details } });
}

function sendCancelled(jobId: JobId) {
  post({ type: 'cancelled', jobId });
}

function msToFFmpegTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
    .toFixed(3)
    .padStart(6, '0')}`;
}

async function ensureFFmpegLoaded(): Promise<void> {
  if (ffmpeg && ffmpeg.loaded) return;

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }: { message: string }) => {
    console.log('[ffmpeg]', message);
  });

  ffmpeg.on('progress', ({ progress }: { progress: number }) => {
    if (!currentJobId || typeof progress !== 'number') return;
    sendProgress(currentJobId, { progress, stage: 'encoding' });
  });

  await ffmpeg.load({ coreURL: CORE_JS_URL, wasmURL: CORE_WASM_URL });
}

async function cleanup(files: string[]) {
  if (!ffmpeg) return;
  await Promise.all(
    files.map(async (file) => {
      try {
        await ffmpeg!.deleteFile(file);
      } catch {
        // ignore
      }
    })
  );
}

async function handleTrim(jobId: JobId, payload: TrimPayload) {
  const { inputBlob, startMs, endMs, outputFormat = 'mp4' } = payload;

  const startTime = performance.now();
  currentJobId = jobId;
  cancelRequested = false;

  const inputFileName = 'input.mp4';
  const outputFileName = `output.${outputFormat}`;

  try {
    sendProgress(jobId, { progress: 0.05, stage: 'initializing' });
    await ensureFFmpegLoaded();
    if (cancelRequested) {
      sendCancelled(jobId);
      return;
    }

    sendProgress(jobId, { progress: 0.1, stage: 'loading input' });
    const inputData = await fetchFile(inputBlob);
    await ffmpeg!.writeFile(inputFileName, inputData);
    if (cancelRequested) {
      await cleanup([inputFileName]);
      sendCancelled(jobId);
      return;
    }

    sendProgress(jobId, { progress: 0.2, stage: 'encoding' });

    const startTimeStr = msToFFmpegTime(startMs);
    const endTimeStr = msToFFmpegTime(endMs);
    const videoCodec = outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264';
    const audioCodec = outputFormat === 'webm' ? 'libvorbis' : 'aac';

    await ffmpeg!.exec([
      '-i',
      inputFileName,
      '-ss',
      startTimeStr,
      '-to',
      endTimeStr,
      '-c:v',
      videoCodec,
      '-preset',
      'ultrafast',
      '-crf',
      outputFormat === 'webm' ? '30' : '23',
      '-c:a',
      audioCodec,
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-y',
      outputFileName,
    ]);

    if (cancelRequested) {
      await cleanup([inputFileName, outputFileName]);
      sendCancelled(jobId);
      return;
    }

    sendProgress(jobId, { progress: 0.9, stage: 'reading output' });

    const outputData = (await ffmpeg!.readFile(outputFileName)) as Uint8Array;
    const mime = outputFormat === 'webm' ? 'video/webm' : 'video/mp4';
    const outputBuffer =
      outputData.byteOffset === 0
        ? (outputData.buffer as ArrayBuffer)
        : outputData.slice().buffer;
    const elapsedMs = Math.round(performance.now() - startTime);

    await cleanup([inputFileName, outputFileName]);

    sendProgress(jobId, { progress: 1, stage: 'complete' });
    sendCompleted(jobId, outputBuffer, mime, elapsedMs);
  } catch (error) {
    await cleanup([inputFileName, outputFileName]);
    if (cancelRequested) {
      sendCancelled(jobId);
      return;
    }
    const message = error instanceof Error ? error.message : 'unknown error';
    sendError(
      jobId,
      'OUTPUT_ERROR',
      '영상 트림 중 오류가 발생했습니다.',
      message
    );
  } finally {
    currentJobId = null;
  }
}

async function handleBurnin(jobId: JobId, payload: BurninPayload) {
  const {
    inputBlob,
    startMs,
    endMs,
    srtContent,
    outputFormat = 'mp4',
    videoFilter,
  } = payload;

  const startTime = performance.now();
  currentJobId = jobId;
  cancelRequested = false;

  const inputFileName = 'input.mp4';
  const subtitleFileName = 'subtitles.srt';
  const outputFileName = `output.${outputFormat}`;

  try {
    sendProgress(jobId, { progress: 0.05, stage: 'initializing' });
    await ensureFFmpegLoaded();
    if (cancelRequested) {
      sendCancelled(jobId);
      return;
    }

    sendProgress(jobId, { progress: 0.1, stage: 'loading input' });
    const inputData = await fetchFile(inputBlob);
    await ffmpeg!.writeFile(inputFileName, inputData);
    if (cancelRequested) {
      await cleanup([inputFileName]);
      sendCancelled(jobId);
      return;
    }

    const srtData = new TextEncoder().encode(srtContent);
    await ffmpeg!.writeFile(subtitleFileName, srtData);

    sendProgress(jobId, { progress: 0.2, stage: 'encoding' });

    const startTimeStr = msToFFmpegTime(startMs);
    const endTimeStr = msToFFmpegTime(endMs);
    const videoCodec = outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264';
    const audioCodec = outputFormat === 'webm' ? 'libvorbis' : 'aac';

    const subtitleFilter = `subtitles=${subtitleFileName}:force_style='FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2'`;

    const filterComplex = videoFilter
      ? `${videoFilter},${subtitleFilter}`
      : subtitleFilter;

    await ffmpeg!.exec([
      '-i',
      inputFileName,
      '-ss',
      startTimeStr,
      '-to',
      endTimeStr,
      '-vf',
      filterComplex,
      '-c:v',
      videoCodec,
      '-preset',
      'ultrafast',
      '-crf',
      outputFormat === 'webm' ? '30' : '23',
      '-c:a',
      audioCodec,
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-y',
      outputFileName,
    ]);

    if (cancelRequested) {
      await cleanup([inputFileName, subtitleFileName, outputFileName]);
      sendCancelled(jobId);
      return;
    }

    sendProgress(jobId, { progress: 0.9, stage: 'reading output' });

    const outputData = (await ffmpeg!.readFile(outputFileName)) as Uint8Array;
    const mime = outputFormat === 'webm' ? 'video/webm' : 'video/mp4';
    const outputBuffer =
      outputData.byteOffset === 0
        ? (outputData.buffer as ArrayBuffer)
        : outputData.slice().buffer;
    const elapsedMs = Math.round(performance.now() - startTime);

    await cleanup([inputFileName, subtitleFileName, outputFileName]);

    sendProgress(jobId, { progress: 1, stage: 'complete' });
    sendCompleted(jobId, outputBuffer, mime, elapsedMs);
  } catch (error) {
    await cleanup([inputFileName, subtitleFileName, outputFileName]);
    if (cancelRequested) {
      sendCancelled(jobId);
      return;
    }
    const message = error instanceof Error ? error.message : 'unknown error';
    sendError(
      jobId,
      'OUTPUT_ERROR',
      '자막 번인 중 오류가 발생했습니다.',
      message
    );
  } finally {
    currentJobId = null;
  }
}

async function handleProbe(jobId: JobId, payload: ProbePayload) {
  const { inputBlob } = payload;
  currentJobId = jobId;
  cancelRequested = false;

  const inputFileName = 'probe_input.mp4';

  try {
    await ensureFFmpegLoaded();
    const inputData = await fetchFile(inputBlob);
    await ffmpeg!.writeFile(inputFileName, inputData);

    await cleanup([inputFileName]);

    sendProbe(jobId, {
      durationMs: 0,
      width: 0,
      height: 0,
      codec: 'unknown',
    });
  } catch (error) {
    await cleanup([inputFileName]);
    const message = error instanceof Error ? error.message : 'unknown error';
    sendError(jobId, 'INPUT_ERROR', '파일 분석 실패', message);
  } finally {
    currentJobId = null;
  }
}

function handleCancel(jobId: JobId) {
  if (currentJobId !== jobId) return;
  cancelRequested = true;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      try {
        await ensureFFmpegLoaded();
        post({ type: 'init-complete', success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'init failed';
        post({ type: 'init-complete', success: false, error: message });
      }
      break;

    case 'trim':
      await handleTrim(msg.jobId, msg.payload);
      break;

    case 'burnin':
      await handleBurnin(msg.jobId, msg.payload);
      break;

    case 'probe':
      await handleProbe(msg.jobId, msg.payload);
      break;

    case 'cancel':
      handleCancel(msg.jobId);
      break;

    default:
      console.warn('[ffmpeg.worker] Unknown message type');
  }
};

post({ type: 'ready' });

export {};
