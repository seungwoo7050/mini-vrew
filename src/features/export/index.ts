export { useVideoExport } from './useVideoExport';
export type {
  ExportState,
  ExportOptions,
  UseVideoExportReturn,
} from './useVideoExport';

export {
  initFFmpegWorker,
  terminateFFmpegWorker,
  isFFmpegReady,
  isJobRunning,
  trimVideo,
  exportWithSubtitles,
  probeVideo,
  cancelCurrentJob,
} from './ffmpegClient';

export { captionsToSrt, adjustSrtForTrim, formatSrtTimecode } from './srtUtils';

export type {
  JobId,
  ProgressData,
  CompletedData,
  ProbeData,
  ErrorData,
  JobOptions,
  TrimPayload,
  BurninPayload,
} from './ffmpegTypes';
