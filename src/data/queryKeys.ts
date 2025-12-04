import type { VideoId } from './types';

export const videosKey = ['videos'] as const;

export function videoKey(id: VideoId) {
  return ['videos', id] as const;
}

export function videoBlobKey(id: VideoId) {
  return ['video-blob', id] as const;
}

export function thumbnailBlobKey(id: VideoId) {
  return ['thumbnail-blob', id] as const;
}

export function captionsKey(id: VideoId) {
  return ['captions', id] as const;
}
