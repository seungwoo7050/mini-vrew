import type { Caption, CaptionWord } from '@/data/types';

export function tokenizeText(text: string): string[] {
  return text.split(/\s+/).filter((token) => token.length > 0);
}

export function computeFallbackWordTimings(caption: Caption): CaptionWord[] {
  if (caption.words && caption.words.length > 0) {
    return caption.words;
  }

  const words = tokenizeText(caption.text);
  if (words.length === 0) return [];

  const durationMs = caption.endMs - caption.startMs;
  const wordDurationMs = durationMs / words.length;

  return words.map((text, index) => ({
    text,
    startMs: caption.startMs + index * wordDurationMs,
    endMs: caption.startMs + (index + 1) * wordDurationMs,
  }));
}

export function findActiveWordIndex(
  words: CaptionWord[],
  currentTimeMs: number
): number {
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (currentTimeMs >= word.startMs && currentTimeMs <= word.endMs) {
      return i;
    }
  }
  return -1;
}

export function findActiveCaptionAndWord(
  captions: Caption[],
  currentTimeMs: number
): { caption: Caption; words: CaptionWord[]; activeWordIndex: number } | null {
  for (const caption of captions) {
    if (currentTimeMs >= caption.startMs && currentTimeMs <= caption.endMs) {
      const words = computeFallbackWordTimings(caption);
      const activeWordIndex = findActiveWordIndex(words, currentTimeMs);
      return { caption, words, activeWordIndex };
    }
  }
  return null;
}
