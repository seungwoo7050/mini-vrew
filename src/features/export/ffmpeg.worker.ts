import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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

const CORE_JS_URL = new URL('@ffmpeg/core', import.meta.url).toString();
const CORE_WASM_URL = new URL('@ffmpeg/core/wasm', import.meta.url).toString();
const DEFAULT_FONT_URL = new URL(
  '/fonts/DejaVuSans.ttf',
  self.location.origin
).toString();
const DEFAULT_FONT_PATH = '/fonts/DejaVuSans.ttf';
let cachedCoreUrls: { coreURL: string; wasmURL: string } | null = null;
let fontLoaded = false;

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

function timeToSeconds(time: string): number {
  const [h, m, s] = time.split(':');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
}

function parseAssForDrawtext(assContent: string): string {
  const lines = assContent.split('\n');
  const dialogues = lines.filter((line) => line.startsWith('Dialogue:'));
  const filters = dialogues.map((dialogue) => {
    const parts = dialogue.split(',');
    const start = parts[1];
    const end = parts[2];
    const text = parts
      .slice(9)
      .join(',')
      .replace(/\{[^}]*\}/g, '');
    const escapedText = text.replace(/'/g, "\\'");
    return `drawtext=text='${escapedText}':fontfile=/fonts/DejaVuSans.ttf:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=h-100:enable='between(t,${timeToSeconds(start)},${timeToSeconds(end)})'`;
  });
  return filters.join(',');
}

async function resolveCoreUrls() {
  if (cachedCoreUrls) return cachedCoreUrls;

  const coreURL = await toBlobURL(CORE_JS_URL, 'text/javascript');
  const wasmURL = await toBlobURL(CORE_WASM_URL, 'application/wasm');

  cachedCoreUrls = { coreURL, wasmURL };
  return cachedCoreUrls;
}

async function ensureFontAvailable(): Promise<string | null> {
  if (!ffmpeg) return null;
  if (fontLoaded) return DEFAULT_FONT_PATH;

  try {
    await ffmpeg.readFile(DEFAULT_FONT_PATH);
    fontLoaded = true;
    return DEFAULT_FONT_PATH;
  } catch {
    // ignore
  }

  try {
    console.log('[ffmpeg.worker] Fetching font from', DEFAULT_FONT_URL);
    const res = await fetch(DEFAULT_FONT_URL);
    if (!res.ok) throw new Error(`Font fetch failed with status ${res.status}`);
    const buffer = new Uint8Array(await res.arrayBuffer());
    try {
      await ffmpeg.createDir?.('/fonts');
    } catch {
      // ignore
    }
    console.log(
      '[ffmpeg.worker] Writing font to FS:',
      DEFAULT_FONT_PATH,
      'size:',
      buffer.length
    );
    await ffmpeg.writeFile(DEFAULT_FONT_PATH, buffer);
    const verify = await ffmpeg.readFile(DEFAULT_FONT_PATH);
    console.log('[ffmpeg.worker] Font verification size:', verify.length);
    fontLoaded = true;
    return DEFAULT_FONT_PATH;
  } catch (error) {
    console.error(
      '[ffmpeg.worker] Failed to load font; subtitles may not render:',
      error
    );
    return null;
  }
}

function buildTrimArgs(startMs: number, endMs?: number | null): string[] {
  const args: string[] = [];

  if (startMs > 0) {
    args.push('-ss', msToFFmpegTime(startMs));
  }

  if (typeof endMs === 'number' && Number.isFinite(endMs)) {
    const durationMs = endMs - startMs;
    args.push('-t', msToFFmpegTime(durationMs));
  }

  return args;
}

async function ensureFFmpegLoaded(): Promise<void> {
  console.log('[ffmpeg.worker] ensureFFmpegLoaded called');
  console.log('[ffmpeg.worker] crossOriginIsolated:', self.crossOriginIsolated);
  console.log(
    '[ffmpeg.worker] SharedArrayBuffer supported:',
    typeof SharedArrayBuffer !== 'undefined'
  );
  if (ffmpeg && ffmpeg.loaded) {
    console.log('[ffmpeg.worker] FFmpeg already loaded');
    return;
  }

  console.log('[ffmpeg.worker] Creating new FFmpeg instance');
  ffmpeg = new FFmpeg();

  console.log('[ffmpeg.worker] Setting up FFmpeg event listeners');
  ffmpeg.on('log', ({ message }: { message: string }) => {
    console.log('[ffmpeg.worker] FFmpeg log:', message);
  });

  ffmpeg.on('progress', ({ progress }: { progress: number }) => {
    console.log('[ffmpeg.worker] FFmpeg progress event:', progress);
    if (!currentJobId || typeof progress !== 'number') return;
    sendProgress(currentJobId, { progress, stage: 'encoding' });
  });

  console.log(
    '[ffmpeg.worker] Loading FFmpeg core from URLs:',
    CORE_JS_URL,
    CORE_WASM_URL
  );
  console.log('[ffmpeg.worker] Starting ffmpeg.load()');
  const loadStart = performance.now();
  try {
    const { coreURL, wasmURL } = await resolveCoreUrls();
    const loadPromise = ffmpeg.load({ coreURL, wasmURL });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('FFmpeg load timeout after 30s')),
        30000
      );
    });
    await Promise.race([loadPromise, timeoutPromise]);
    const loadTime = performance.now() - loadStart;
    console.log(
      '[ffmpeg.worker] FFmpeg loaded successfully in',
      loadTime,
      'ms, loaded:',
      ffmpeg.loaded
    );
  } catch (error) {
    console.error(
      '[ffmpeg.worker] Failed to load FFmpeg after',
      performance.now() - loadStart,
      'ms:',
      error
    );
    throw error;
  }
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

  console.log(
    '[ffmpeg.worker] handleTrim called with jobId:',
    jobId,
    'payload:',
    payload
  );
  const startTime = performance.now();
  currentJobId = jobId;
  cancelRequested = false;

  const inputFileName = 'input.mp4';
  const outputFileName = `output.${outputFormat}`;

  try {
    console.log('[ffmpeg.worker] Sending initial progress: 0.05');
    sendProgress(jobId, { progress: 0.05, stage: 'initializing' });
    console.log('[ffmpeg.worker] Ensuring FFmpeg is loaded');
    await ensureFFmpegLoaded();
    console.log('[ffmpeg.worker] FFmpeg ready, proceeding with trim');
    if (cancelRequested) {
      sendCancelled(jobId);
      return;
    }

    console.log('[ffmpeg.worker] Sending progress: 0.1, loading input');
    sendProgress(jobId, { progress: 0.1, stage: 'loading input' });
    console.log('[ffmpeg.worker] Fetching input file from blob');
    const inputData = await fetchFile(inputBlob);
    console.log(
      '[ffmpeg.worker] Writing input file to FS, size:',
      inputData.length
    );
    await ffmpeg!.writeFile(inputFileName, inputData);
    if (cancelRequested) {
      console.log('[ffmpeg.worker] Cancel requested after writing input');
      await cleanup([inputFileName]);
      sendCancelled(jobId);
      return;
    }

    console.log('[ffmpeg.worker] Sending progress: 0.2, encoding');
    sendProgress(jobId, { progress: 0.2, stage: 'encoding' });

    const trimArgs = buildTrimArgs(startMs, endMs);
    await ffmpeg!.exec([
      ...trimArgs,
      '-i',
      inputFileName,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      '-avoid_negative_ts',
      'make_zero',
      '-y',
      outputFileName,
    ]);

    if (cancelRequested) {
      await cleanup([inputFileName, outputFileName]);
      sendCancelled(jobId);
      return;
    }

    console.log('[ffmpeg.worker] Sending progress: 0.9, reading output');
    sendProgress(jobId, { progress: 0.9, stage: 'reading output' });

    console.log('[ffmpeg.worker] Reading output file');
    const outputData = (await ffmpeg!.readFile(outputFileName)) as Uint8Array;
    console.log('[ffmpeg.worker] Output file size bytes:', outputData.length);
    if (outputData.length === 0) {
      throw new Error('FFmpeg conversion failed: output file is empty');
    }
    const mime = outputFormat === 'webm' ? 'video/webm' : 'video/mp4';
    const outputBuffer =
      outputData.byteOffset === 0
        ? (outputData.buffer as ArrayBuffer)
        : outputData.slice().buffer;
    const elapsedMs = Math.round(performance.now() - startTime);

    console.log('[ffmpeg.worker] Cleanup files');
    await cleanup([inputFileName, outputFileName]);

    console.log(
      '[ffmpeg.worker] Sending completed message, elapsed:',
      elapsedMs
    );
    sendProgress(jobId, { progress: 1, stage: 'complete' });
    sendCompleted(jobId, outputBuffer, mime, elapsedMs);
  } catch (error) {
    console.error('[ffmpeg.worker] Error in handleTrim:', error);
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

    const fontPath = await ensureFontAvailable();
    if (!fontPath) {
      throw new Error('Font not available for subtitles');
    }

    sendProgress(jobId, { progress: 0.2, stage: 'encoding' });

    const trimArgs = buildTrimArgs(startMs, endMs);
    const videoCodec = outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264';
    const audioCodec = outputFormat === 'webm' ? 'libvorbis' : 'aac';

    const subtitleFilter = parseAssForDrawtext(srtContent);

    const filterComplex = videoFilter
      ? `${videoFilter},${subtitleFilter}`
      : subtitleFilter;

    console.log('[ffmpeg.worker] Subtitle filter:', subtitleFilter);
    console.log('[ffmpeg.worker] Filter complex:', filterComplex);
    console.log(
      '[ffmpeg.worker] SRT content preview:',
      srtContent.substring(0, 200)
    );

    const ffmpegArgs = [
      ...trimArgs,
      '-i',
      inputFileName,
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
    ];

    console.log('[ffmpeg.worker] Executing burn-in args:', ffmpegArgs);
    await ffmpeg!.exec(ffmpegArgs);

    if (cancelRequested) {
      await cleanup([inputFileName, outputFileName]);
      sendCancelled(jobId);
      return;
    }

    sendProgress(jobId, { progress: 0.9, stage: 'reading output' });

    const outputData = (await ffmpeg!.readFile(outputFileName)) as Uint8Array;
    if (outputData.length === 0) {
      throw new Error('FFmpeg conversion failed: output file is empty');
    }
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
      console.log(
        '[ffmpeg.worker] Received init message, calling ensureFFmpegLoaded'
      );
      try {
        await ensureFFmpegLoaded();
        console.log('[ffmpeg.worker] Init complete, posting success');
        post({ type: 'init-complete', success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'init failed';
        console.error('[ffmpeg.worker] Init failed:', message);
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
