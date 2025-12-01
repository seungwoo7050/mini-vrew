import type {
  Caption,
  CreateVideoInput,
  Video,
  VideoId,
  VideoMetadataPatch,
} from './types.js';

export type AppApi = {
  listVideos(): Promise<Video[]>;
  getVideo(id: VideoId): Promise<Video | null>;
  createVideo(input: CreateVideoInput): Promise<Video>;
  updateVideoMetadata(id: VideoId, patch: VideoMetadataPatch): Promise<void>;
  deleteVideo(id: VideoId): Promise<void>;

  listCaptions(videoId: VideoId): Promise<Caption[]>;
  saveCaptions(videoId: VideoId, captions: Caption[]): Promise<void>;

  putVideoBlob(videoId: VideoId, blob: Blob): Promise<void>;
  getVideoBlob(videoId: VideoId): Promise<Blob | null>;

  putThumbnailBlob(videoId: VideoId, blob: Blob): Promise<void>;
  getThumbnailBlob(videoId: VideoId): Promise<Blob | null>;
};
