import { describe, expect, it } from 'vitest';
import { parseTimecode, formatTimecode } from '../features/captions/time';

describe('시간 유틸리티 (subtitle)', () => {
  it('여러 타임코드 포맷을 파싱한다', () => {
    expect(parseTimecode('00:00:00,000')).toBe(0);
    expect(parseTimecode('00:00:01,234')).toBe(1234);
    expect(parseTimecode('1:02:03,004')).toBe(
      1 * 3600_000 + 2 * 60_000 + 3 * 1000 + 4
    );
    expect(parseTimecode('05:06:07.089')).toBe(
      5 * 3600_000 + 6 * 60_000 + 7 * 1000 + 89
    );
    expect(parseTimecode('12')).toBe(12 * 1000);
    expect(parseTimecode('12.345')).toBe(12 * 1000 + 345);
    expect(parseTimecode('not a time')).toBeNull();
    expect(parseTimecode('05:06')).toBe(5 * 60_000 + 6 * 1000);
    expect(parseTimecode('05:06.250')).toBe(5 * 60_000 + 6 * 1000 + 250);
  });

  it('타임코드를 올바르게 포맷한다', () => {
    expect(formatTimecode(0)).toBe('00:00:00,000');
    expect(formatTimecode(1234)).toBe('00:00:01,234');
    expect(formatTimecode(3_660_001)).toBe('01:01:00,001');
    expect(formatTimecode(3_660_001, '.')).toBe('01:01:00.001');
    expect(formatTimecode(-123)).toBe('00:00:00,000');
    expect(formatTimecode(1234.9)).toBe('00:00:01,234');
  });
});
