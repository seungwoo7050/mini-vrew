import { describe, expect, it } from 'vitest';
import {
  parseCaptions,
  toSrt,
  toVtt,
  sortCaptions,
} from '../features/captions/format';

describe('캡션 포맷 유틸', () => {
  it('SRT를 파싱한다', () => {
    const srt = `1
00:00:00,000 --> 00:00:01,234
hello

2
00:00:05,000 --> 00:00:06,000
world
`;

    const caps = parseCaptions(srt);
    expect(caps).toHaveLength(2);
    expect(caps[0].startMs).toBe(0);
    expect(caps[0].endMs).toBe(1234);
    expect(caps[0].text).toBe('hello');
  });

  it('인덱스 라인이 있는 SRT와 CRLF를 처리하고 id와 mm:ss를 지원한다', () => {
    const srt = `1\r\n05:00 --> 06:00\r\nfirst\r\n\r\n2\r\n00:00:05 --> 00:00:06\r\nsecond\r\n`;
    const caps = parseCaptions(srt);
    expect(caps).toHaveLength(2);

    expect(caps[0].id).toMatch(/^cap_0001$/);
    expect(caps[0].startMs).toBe(5 * 1000);
    expect(caps[1].startMs).toBe(5 * 60_000);
  });

  it('잘못된 블록(종료 <= 시작)을 무시한다', () => {
    const srt = `1\n00:00:10,000 --> 00:00:05,000\nbad\n`;
    expect(parseCaptions(srt)).toEqual([]);
  });

  it('toSrt와 toVtt를 생성한다', () => {
    const captions = [
      { id: 'a', startMs: 0, endMs: 1234, text: 'hello' },
      { id: 'b', startMs: 5000, endMs: 6000, text: 'world' },
    ];

    const srt = toSrt(captions);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:01,234');
    expect(srt).toContain('2\n00:00:05,000 --> 00:00:06,000');

    const vtt = toVtt(captions);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:01.234');
  });

  it('sortCaptions로 start, end로 안정 정렬된다', () => {
    const unsorted = [
      { id: 'b', startMs: 0, endMs: 6000, text: 'world' },
      { id: 'a', startMs: 0, endMs: 1234, text: 'hello' },
    ];

    const sorted = sortCaptions(unsorted);
    expect(sorted[0].endMs).toBe(1234);
    expect(sorted[1].endMs).toBe(6000);
  });
});
