import type { Caption } from '@/data/types';
import { computeFallbackWordTimings } from './wordHighlight';

export function makeCaptionId(): string {
  return `cap_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

export function splitCaptionNewline(
  caption: Caption,
  wordIndex: number
): Caption | null {
  const words = computeFallbackWordTimings(caption);
  if (wordIndex <= 0 || wordIndex >= words.length) return null;

  const head = words
    .slice(0, wordIndex)
    .map((w) => w.text)
    .join(' ');
  const tail = words
    .slice(wordIndex)
    .map((w) => w.text)
    .join(' ');
  const textWithBreak = [head, tail].filter(Boolean).join('\n');

  return {
    ...caption,
    text: textWithBreak,
    words,
  };
}

export function splitCaptionNext(
  caption: Caption,
  wordIndex: number
): [Caption, Caption] | null {
  const words = computeFallbackWordTimings(caption);
  if (wordIndex <= 0 || wordIndex >= words.length) return null;

  const headWords = words.slice(0, wordIndex);
  const tailWords = words.slice(wordIndex);

  if (headWords.length === 0 || tailWords.length === 0) return null;

  const splitMs = tailWords[0].startMs;
  const firstEnd = splitMs;
  const secondStart = splitMs + 1;
  const secondEnd = Math.max(secondStart + 10, caption.endMs);

  const firstCaption: Caption = {
    ...caption,
    endMs: firstEnd,
    text: headWords.map((w) => w.text).join(' '),
    words: headWords,
  };

  const secondCaption: Caption = {
    ...caption,
    id: makeCaptionId(),
    startMs: secondStart,
    endMs: secondEnd,
    text: tailWords.map((w) => w.text).join(' '),
    words: tailWords,
  };

  return [firstCaption, secondCaption];
}

export function applySplitCaption(
  captions: Caption[],
  captionId: string,
  wordIndex: number,
  mode: 'newline' | 'next'
): Caption[] | null {
  const target = captions.find((c) => c.id === captionId);
  if (!target) return null;

  if (mode === 'newline') {
    const updated = splitCaptionNewline(target, wordIndex);
    if (!updated) return null;

    return captions
      .map((c) => (c.id === captionId ? updated : c))
      .sort((a, b) => a.startMs - b.startMs);
  }

  const result = splitCaptionNext(target, wordIndex);
  if (!result) return null;

  const [first, second] = result;

  return captions
    .flatMap((c) => (c.id === captionId ? [first, second] : [c]))
    .sort((a, b) => a.startMs - b.startMs);
}

export function mergeCaptions(a: Caption, b: Caption): Caption {
  const wordsA = computeFallbackWordTimings(a);
  const wordsB = computeFallbackWordTimings(b);
  const mergedWords = [...wordsA, ...wordsB].sort(
    (x, y) => x.startMs - y.startMs
  );

  return {
    ...a,
    startMs: Math.min(a.startMs, b.startMs),
    endMs: Math.max(a.endMs, b.endMs),
    text: mergedWords.map((w) => w.text).join(' '),
    words: mergedWords,
  };
}

export function applyMergeCaption(
  captions: Caption[],
  captionId: string,
  direction: 'up' | 'down'
): Caption[] | null {
  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  const idx = sorted.findIndex((c) => c.id === captionId);
  if (idx === -1) return null;

  const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= sorted.length) return null;

  const a = direction === 'up' ? sorted[neighborIdx] : sorted[idx];
  const b = direction === 'up' ? sorted[idx] : sorted[neighborIdx];

  const merged = mergeCaptions(a, b);

  return sorted
    .filter((_, i) => i !== idx && i !== neighborIdx)
    .concat(merged)
    .sort((x, y) => x.startMs - y.startMs);
}
