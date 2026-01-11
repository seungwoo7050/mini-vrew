import type { Caption } from '@/data/types';

export function formatSrtTimecode(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);

  return (
    `${hours.toString().padStart(2, '0')}:` +
    `${minutes.toString().padStart(2, '0')}:` +
    `${seconds.toString().padStart(2, '0')},` +
    `${milliseconds.toString().padStart(3, '0')}`
  );
}

export function captionsToSrt(captions: Caption[]): string {
  if (captions.length === 0) return '';

  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);

  return sorted
    .map((caption, index) => {
      const startTime = formatSrtTimecode(caption.startMs);
      const endTime = formatSrtTimecode(caption.endMs);
      const text = caption.text.trim();

      return `${index + 1}\n${startTime} --> ${endTime}\n${text}`;
    })
    .join('\n\n');
}

export function adjustSrtForTrim(
  captions: Caption[],
  trimStartMs: number,
  trimEndMs: number
): string {
  const filtered = captions.filter((c) => {
    return c.startMs < trimEndMs && c.endMs > trimStartMs;
  });

  const adjusted = filtered.map((c) => ({
    ...c,
    startMs: Math.max(0, c.startMs - trimStartMs),
    endMs: Math.min(trimEndMs - trimStartMs, c.endMs - trimStartMs),
  }));

  return captionsToSrt(adjusted);
}