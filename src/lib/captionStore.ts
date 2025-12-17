import Dexie, { type Table } from 'dexie';

import type { Caption } from '@/data/types';

type StoredCaptions = {
  videoId: string;
  captionsJson: string;
  createdAt: number;
  updatedAt: number;
};

class CaptionDatabase extends Dexie {
  captions!: Table<StoredCaptions, string>;

  constructor() {
    super('vrew-captions');
    this.version(1).stores({ captions: 'videoId,updatedAt,createdAt' });
  }
}

const hasIndexedDb = typeof indexedDB !== 'undefined';
const db: CaptionDatabase | null = hasIndexedDb ? new CaptionDatabase() : null;

const memory = new Map<string, StoredCaptions>();

export async function saveCaptions(
  videoId: string,
  captions: Caption[]
): Promise<void> {
  const payload: StoredCaptions = {
    videoId,
    captionsJson: JSON.stringify(captions),
    createdAt: memory.get(videoId)?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };

  if (db) {
    const existing = await db.captions.get(videoId);
    await db.captions.put({
      ...payload,
      createdAt: existing?.createdAt ?? payload.createdAt,
    });
    return;
  }

  const existing = memory.get(videoId);
  memory.set(videoId, {
    ...payload,
    createdAt: existing?.createdAt ?? payload.createdAt,
  });
}

export async function getCaptions(videoId: string): Promise<Caption[]> {
  const stored = db ? await db.captions.get(videoId) : memory.get(videoId);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored.captionsJson);
    return Array.isArray(parsed) ? (parsed as Caption[]) : [];
  } catch {
    return [];
  }
}

export async function deleteCaptions(videoId: string): Promise<void> {
  if (db) {
    await db.captions.delete(videoId);
    return;
  }
  memory.delete(videoId);
}
