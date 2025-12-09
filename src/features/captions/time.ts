import { formatTimestamp } from 'subtitle';

function toNumber(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseTimecode(raw: string): number | null {
  const str = String(raw).trim();
  if (!str) return null;

  const re =
    /^(?:(?<hours>\d+):)?(?<minutes>\d{1,2}):(?<seconds>\d{1,2})(?:[.,](?<ms>\d{1,3}))?$/;
  const match = str.match(re);
  if (match?.groups) {
    const { hours = '0', minutes, seconds, ms = '0' } = match.groups;

    const hh = toNumber(hours);
    const mm = toNumber(minutes);
    const ss = toNumber(seconds);
    const msPart = toNumber(ms.padEnd(3, '0').slice(0, 3));

    if (hh === null || mm === null || ss === null || msPart === null)
      return null;
    if (mm < 0 || mm >= 60 || ss < 0 || ss >= 60) return null;

    return hh * 3600_000 + mm * 60_000 + ss * 1000 + msPart;
  }

  const reSeconds = /^(?:(?<secondsOnly>\d+)(?:[.,](?<msOnly>\d{1,3}))?)$/;
  const match2 = str.match(reSeconds);
  if (match2?.groups) {
    const sec = toNumber(match2.groups.secondsOnly);
    const msPart = toNumber(
      (match2.groups.msOnly ?? '0').padEnd(3, '0').slice(0, 3)
    );
    if (sec === null || msPart === null) return null;
    return sec * 1000 + msPart;
  }

  return null;
}

export function formatTimecode(ms: number, separator: ',' | '.' = ','): string {
  const clamped = Math.max(0, Math.floor(Number(ms) || 0));
  const format = separator === ',' ? 'SRT' : 'WebVTT';
  return formatTimestamp(clamped, { format: format as 'SRT' | 'WebVTT' });
}
