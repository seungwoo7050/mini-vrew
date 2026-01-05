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
  const firstEnd = Math.max(splitMs, caption.startMs + 10);
  const secondStart = splitMs;
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

  // mode === 'next'
  const result = splitCaptionNext(target, wordIndex);
  if (!result) return null;

  const [first, second] = result;

  return captions
    .flatMap((c) => (c.id === captionId ? [first, second] : [c]))
    .sort((a, b) => a.startMs - b.startMs);
}
