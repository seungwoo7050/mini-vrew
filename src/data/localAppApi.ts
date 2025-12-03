import { sampleVideos } from './fixtures';
import type { AppApi } from './AppApi';
import type {
  Caption,
  CreateVideoInput,
  Video,
  VideoId,
  VideoMetadataPatch,
} from './types';

const memory = {
  videos: new Map<VideoId, Video>(),
  captions: new Map<VideoId, Caption[]>(),
  videoBlobs: new Map<VideoId, Blob>(),
  thumbBlobs: new Map<VideoId, Blob>(),
};

let seeded = false;
let seq = sampleVideos.length + 1;

function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  sampleVideos.forEach((video) => {
    memory.videos.set(video.id, { ...video });
  });
}

function nextId(): VideoId {
  const id = `local_${String(seq).padStart(3, '0')}`;
  seq += 1;
  return id;
}

function cloneVideo(video: Video): Video {
  return { ...video };
}

function cloneCaptions(captions: Caption[]): Caption[] {
  return captions.map((caption) => ({ ...caption }));
}

export function createLocalAppApi(): AppApi {
  ensureSeeded();

  return {
    async listVideos(): Promise<Video[]> {
      ensureSeeded();
      return [...memory.videos.values()]
        .map(cloneVideo)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async getVideo(id: VideoId): Promise<Video | null> {
      ensureSeeded();
      const found = memory.videos.get(id);
      return found ? cloneVideo(found) : null;
    },

    async createVideo(input: CreateVideoInput): Promise<Video> {
      ensureSeeded();
      const video: Video = {
        id: input.id ?? nextId(),
        title: input.title,
        createdAt: input.createdAt ?? Date.now(),
      };
      memory.videos.set(video.id, video);
      return cloneVideo(video);
    },

    async updateVideoMetadata(
      id: VideoId,
      patch: VideoMetadataPatch
    ): Promise<void> {
      ensureSeeded();
      const existing = memory.videos.get(id);
      if (!existing) return;
      const updated = { ...existing, ...patch } satisfies Video;
      memory.videos.set(id, updated);
    },

    async deleteVideo(id: VideoId): Promise<void> {
      ensureSeeded();
      memory.videos.delete(id);
      memory.captions.delete(id);
      memory.videoBlobs.delete(id);
      memory.thumbBlobs.delete(id);
    },

    async listCaptions(videoId: VideoId): Promise<Caption[]> {
      ensureSeeded();
      const stored = memory.captions.get(videoId) ?? [];
      return cloneCaptions(stored);
    },

    async saveCaptions(videoId: VideoId, captions: Caption[]): Promise<void> {
      ensureSeeded();
      memory.captions.set(videoId, cloneCaptions(captions));
    },

    async putVideoBlob(videoId: VideoId, blob: Blob): Promise<void> {
      ensureSeeded();
      memory.videoBlobs.set(videoId, blob);
    },

    async getVideoBlob(videoId: VideoId): Promise<Blob | null> {
      ensureSeeded();
      return memory.videoBlobs.get(videoId) ?? null;
    },

    async putThumbnailBlob(videoId: VideoId, blob: Blob): Promise<void> {
      ensureSeeded();
      memory.thumbBlobs.set(videoId, blob);
    },

    async getThumbnailBlob(videoId: VideoId): Promise<Blob | null> {
      ensureSeeded();
      return memory.thumbBlobs.get(videoId) ?? null;
    },
  };
}
