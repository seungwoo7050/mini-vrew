// import { sampleVideos } from './fixtures';
import type { AppApi } from './AppApi';
import type {
  Caption,
  CreateVideoInput,
  Video,
  VideoId,
  VideoMetadataPatch,
} from './types';
import { createVideoId } from './types';
import { deleteCaptions, getCaptions, saveCaptions } from '@/lib/captionStore';
import {
  deleteThumbnailBlob,
  deleteVideoBlob,
  deleteVideoMeta,
  getThumbnailBlob,
  getVideoBlob,
  getVideoMeta,
  listVideoMetas,
  saveThumbnailBlob,
  saveVideoBlob,
  saveVideoMeta,
} from '@/lib/localAssetStore';

let seeded = false;

function generateVideoId(prefix = 'local'): VideoId {
  const id =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Date.now().toString(36);
  return createVideoId(`${prefix}_${id}`);
}

async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;
  // const existing = await listVideoMetas();
  // if (existing.length > 0) return;
  // await Promise.all(sampleVideos.map((video) => saveVideoMeta(video)));
}

async function ensureVideoMeta(id: VideoId): Promise<Video | null> {
  await ensureSeeded();
  return (await getVideoMeta(id)) ?? null;
}

export function createLocalAppApi(): AppApi {
  return {
    async listVideos(): Promise<Video[]> {
      await ensureSeeded();
      const metas = await listVideoMetas();
      return metas
        .map((video) => ({ ...video }))
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async getVideo(id: VideoId): Promise<Video | null> {
      return ensureVideoMeta(id);
    },

    async createVideo(input: CreateVideoInput): Promise<Video> {
      await ensureSeeded();
      const video: Video = {
        id: input.id ?? generateVideoId(),
        title: input.title,
        createdAt: input.createdAt ?? Date.now(),
      };
      await saveVideoMeta(video);
      return { ...video };
    },

    async updateVideoMetadata(
      id: VideoId,
      patch: VideoMetadataPatch
    ): Promise<void> {
      const existing = await ensureVideoMeta(id);
      if (!existing) return;
      await saveVideoMeta({ ...existing, ...patch });
    },

    async deleteVideo(id: VideoId): Promise<void> {
      await ensureSeeded();
      await Promise.all([
        deleteVideoMeta(id),
        deleteCaptions(id),
        deleteVideoBlob(id),
        deleteThumbnailBlob(id),
      ]);
    },

    async listCaptions(videoId: VideoId): Promise<Caption[]> {
      await ensureSeeded();
      const stored = await getCaptions(videoId);
      return stored.map((cap) => ({ ...cap }));
    },

    async saveCaptions(videoId: VideoId, captions: Caption[]): Promise<void> {
      await ensureSeeded();
      await saveCaptions(videoId, captions);
    },

    async putVideoBlob(videoId: VideoId, blob: Blob): Promise<void> {
      await ensureSeeded();
      await saveVideoBlob(videoId, blob);
    },

    async getVideoBlob(videoId: VideoId): Promise<Blob | null> {
      await ensureSeeded();
      return getVideoBlob(videoId);
    },

    async putThumbnailBlob(videoId: VideoId, blob: Blob): Promise<void> {
      await ensureSeeded();
      await saveThumbnailBlob(videoId, blob);
    },

    async getThumbnailBlob(videoId: VideoId): Promise<Blob | null> {
      await ensureSeeded();
      return getThumbnailBlob(videoId);
    },
  };
}
