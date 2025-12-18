import { captureThumbnailPairFromFile } from '../thumbnails/thumbnailGenerator';

async function createThumbnailPlaceholder(file: File): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#000000';
    ctx.font = '16px Arial';
    ctx.fillText(`썸네일 없음 (${file.name})`, 10, 30);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('플레이스홀더 이미지 생성 실패'));
      }
    }, 'image/png');
  });
}

export async function createThumbnailForUpload(
  file: File,
  preference?: { quality?: number; atSeconds?: number }
): Promise<{
  jpeg: { blob: Blob; width: number; height: number; mime: string };
  png: { blob: Blob; width: number; height: number; mime: string };
}> {
  try {
    const atSeconds = preference?.atSeconds ?? 0.5;
    const timeoutMs = 8000;
    const jpegQuality = preference?.quality ?? 0.92;

    const pair = await captureThumbnailPairFromFile(
      file,
      atSeconds,
      jpegQuality,
      timeoutMs
    );

    return {
      jpeg: {
        blob: pair.jpeg.blob,
        width: pair.jpeg.width,
        height: pair.jpeg.height,
        mime: pair.jpeg.mime,
      },
      png: {
        blob: pair.png.blob,
        width: pair.png.width,
        height: pair.png.height,
        mime: pair.png.mime,
      },
    };
  } catch (e) {
    console.warn('[thumbnail] 썸네일 생성 실패, 플레이스홀더 사용', e);
    const placeholder = await createThumbnailPlaceholder(file);
    return {
      jpeg: {
        blob: placeholder,
        width: 320,
        height: 180,
        mime: 'image/png',
      },
      png: {
        blob: placeholder,
        width: 320,
        height: 180,
        mime: 'image/png',
      },
    };
  }
}
