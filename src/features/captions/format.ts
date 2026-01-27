import type { Caption, CaptionId } from '@/data/types';
import { createCaptionId } from '@/data/types';
import { formatTimecode, parseTimecode } from './time';

export function sortCaptions(captions: Caption[]): Caption[] {
  return [...captions].sort(
    (a, b) => a.startMs - b.startMs || a.endMs - b.endMs
  );
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trimEnd();
}

function makeId(index: number): CaptionId {
  return createCaptionId(`cap_${String(index).padStart(4, '0')}`);
}

export function parseCaptions(text: string): Caption[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const tempResults: Omit<Caption, 'id'>[] = [];

  blocks.forEach((block) => {
    const lines = block.split('\n').filter(Boolean);
    if (!lines.length) return;

    let timeLine = lines[0];
    if (/^\d+$/.test(timeLine) && lines[1]?.includes('-->')) {
      timeLine = lines[1];
      lines.splice(0, 2);
    } else {
      lines.shift();
    }

    const [startRaw, endRaw] = timeLine.split('-->').map((part) => part.trim());
    const startMs = parseTimecode(startRaw);
    const endMs = parseTimecode(endRaw ?? '');
    const textBody = lines.join('\n').trim();

    if (startMs === null || endMs === null || endMs <= startMs) return;
    tempResults.push({
      startMs,
      endMs,
      text: textBody,
    });
  });

  const ordered = sortCaptions(tempResults as unknown as Caption[]);

  return ordered.map((c, i) => ({
    id: makeId(i + 1),
    startMs: c.startMs,
    endMs: c.endMs,
    text: c.text,
  }));
}

export function toSrt(captions: Caption[]): string {
  const ordered = sortCaptions(captions);
  return ordered
    .map((caption, index) => {
      const start = formatTimecode(caption.startMs, ',');
      const end = formatTimecode(caption.endMs, ',');
      const body = caption.text || '';
      return `${index + 1}\n${start} --> ${end}\n${body}`;
    })
    .join('\n\n');
}

export function toVtt(captions: Caption[]): string {
  const ordered = sortCaptions(captions);
  const body = ordered
    .map((caption) => {
      const start = formatTimecode(caption.startMs, '.');
      const end = formatTimecode(caption.endMs, '.');
      return `${start} --> ${end}\n${caption.text || ''}`;
    })
    .join('\n\n');
  return `WEBVTT\n\n${body}`.trimEnd();
}
