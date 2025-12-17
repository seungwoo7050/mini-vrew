import Dexie, { type Table } from 'dexie';

import type { Video } from '@/data/types';

export type StoredBlob = {
  id: string;
  blob: Blob;
  createdAt: number;
  updatedAt: number;
};

class LocalAssetDatabase extends Dexie {
  videos!: Table<StoredBlob, string>;
  thumbnails!: Table<StoredBlob, string>;
  videosMeta!: Table<Video, string>;

  constructor() {
    super('vrew-assets');
    this.version(1).stores({
      videos: 'id,updatedAt,createdAt',
      thumbnails: 'id,updatedAt,createdAt',
      videosMeta: 'id,createdAt',
    });
  }
}

const hasIndexedDb = typeof indexedDB !== 'undefined';
const db: LocalAssetDatabase | null = hasIndexedDb
  ? new LocalAssetDatabase()
  : null;

const memory = {
  videos: new Map<string, StoredBlob>(),
  thumbnails: new Map<string, StoredBlob>(),
  videosMeta: new Map<string, Video>(),
};

function now(): number {
  return Date.now();
}

type StoreKey = 'videos' | 'thumbnails';

async function upsertBlob(
  tableKey: StoreKey,
  id: string,
  blob: Blob
): Promise<void> {
  const timestamp = now();
  if (db) {
    const existing = await db[tableKey].get(id);
    await db[tableKey].put({
      id,
      blob,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    return;
  }

  const existing = memory[tableKey].get(id);
  memory[tableKey].set(id, {
    id,
    blob,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });
}

async function deleteBlob(tableKey: StoreKey, id: string): Promise<void> {
  if (db) {
    await db[tableKey].delete(id);
    return;
  }
  memory[tableKey].delete(id);
}

async function fetchBlob(
  tableKey: StoreKey,
  id: string
): Promise<StoredBlob | undefined> {
  if (db) return db[tableKey].get(id);
  return memory[tableKey].get(id);
}

export async function saveVideoBlob(id: string, blob: Blob): Promise<void> {
  await upsertBlob('videos', id, blob);
}

export async function saveThumbnailBlob(id: string, blob: Blob): Promise<void> {
  await upsertBlob('thumbnails', id, blob);
}

export async function getVideoBlob(id: string): Promise<Blob | null> {
  const stored = await fetchBlob('videos', id);
  return stored?.blob ?? null;
}

export async function getThumbnailBlob(id: string): Promise<Blob | null> {
  const stored = await fetchBlob('thumbnails', id);
  return stored?.blob ?? null;
}

export async function deleteVideoBlob(id: string): Promise<void> {
  await deleteBlob('videos', id);
}

export async function deleteThumbnailBlob(id: string): Promise<void> {
  await deleteBlob('thumbnails', id);
}

export async function saveVideoMeta(video: Video): Promise<void> {
  const timestamp = now();
  if (db) {
    const existing = await db.videosMeta.get(video.id);
    await db.videosMeta.put({
      ...video,
      createdAt: existing?.createdAt ?? video.createdAt ?? timestamp,
    });
    return;
  }
  const existing = memory.videosMeta.get(video.id);
  memory.videosMeta.set(video.id, {
    ...video,
    createdAt: existing?.createdAt ?? video.createdAt ?? timestamp,
  });
}

export async function getVideoMeta(id: string): Promise<Video | undefined> {
  if (db) return db.videosMeta.get(id);
  return memory.videosMeta.get(id);
}

export async function listVideoMetas(): Promise<Video[]> {
  if (db) return db.videosMeta.toArray();
  return [...memory.videosMeta.values()];
}

export async function deleteVideoMeta(id: string): Promise<void> {
  if (db) {
    await db.videosMeta.delete(id);
    return;
  }
  memory.videosMeta.delete(id);
}
