export type ThumbnailMime = 'image/png' | 'image/jpeg';

export type CaptureThumbnailOptions = {
  mime?: ThumbnailMime;
  quality?: number;
  timeoutMs?: number;
  atSeconds?: number;
};

export type CaptureThumbnailResult = {
  blob: Blob;
  width: number;
  height: number;
  mime: ThumbnailMime;
  videoDurationMs?: number;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: ThumbnailMime,
  quality?: number
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const q =
      mime === 'image/jpeg'
        ? clamp01(typeof quality === 'number' ? quality : 0.92)
        : undefined;
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('캔버스를 Blob으로 변환하지 못했습니다.'));
        }
      },
      mime,
      q
    );
  });
}

const SAFE_TIME_OFFSET = 0.05;

function computeSafeTime(video: HTMLVideoElement, atSeconds: number) {
  const duration = Number.isFinite(video.duration) ? video.duration : undefined;
  if (!duration) return atSeconds;
  return Math.min(atSeconds, Math.max(0, duration - SAFE_TIME_OFFSET));
}

export async function captureThumbnailPairFromFile(
  file: File,
  atSeconds = 0.5,
  jpegQuality = 0.92,
  timeoutMs = 8000
) {
  return new Promise<{
    jpeg: CaptureThumbnailResult;
    png: CaptureThumbnailResult;
  }>((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);

    let timeoutId: number | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      video.removeEventListener('error', onError);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const seekTo = () => {
      const safeTime = computeSafeTime(video, atSeconds);
      try {
        video.currentTime = safeTime;
      } catch {
        fail('썸네일 캡처를 위해 탐색하지 못했습니다.');
      }
    };

    const onSeeked = async () => {
      try {
        const width = video.videoWidth || 320;
        const height = video.videoHeight || 180;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('썸네일 캔버스를 준비하지 못했습니다.');
        ctx.drawImage(video, 0, 0, width, height);

        const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', jpegQuality);
        const pngBlob = await canvasToBlob(canvas, 'image/png', undefined);

        const videoDurationMs = Number.isFinite(video.duration)
          ? Math.round(video.duration * 1000)
          : undefined;
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          jpeg: {
            blob: jpegBlob,
            width,
            height,
            mime: 'image/jpeg',
            videoDurationMs,
          },
          png: {
            blob: pngBlob,
            width,
            height,
            mime: 'image/png',
            videoDurationMs,
          },
        });
      } catch (e) {
        fail(e instanceof Error ? e.message : '썸네일 생성에 실패했습니다.');
      }
    };

    const onLoadedData = () => seekTo();
    const onLoadedMetadata = () => {
      if (video.readyState >= 2) {
        seekTo();
        return;
      }
      video.addEventListener('loadeddata', onLoadedData, { once: true });
    };

    const onError = () => {
      const errorCode = video.error?.code || 'unknown';
      fail(`비디오를 불러오지 못했습니다. 에러 코드: ${errorCode}`);
    };

    timeoutId = window.setTimeout(
      () => fail('썸네일 생성 시간이 초과됐습니다.'),
      timeoutMs
    );

    video.addEventListener('error', onError, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });

    video.src = objectUrl;
    video.load();
  });
}
