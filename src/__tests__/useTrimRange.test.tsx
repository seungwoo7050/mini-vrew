import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import {
  useTrimRange,
  MIN_TRIM_GAP_MS,
} from '@/features/playback/useTrimRange';

describe('useTrimRange', () => {
  it('sets and normalizes range within duration', () => {
    const { result } = renderHook(() => useTrimRange(1000));

    act(() => {
      result.current.actions.setRange(100, 400);
    });

    expect(result.current.range).toEqual({ startMs: 100, endMs: 400 });
  });

  it('rejects ranges smaller than MIN_TRIM_GAP_MS', () => {
    const { result } = renderHook(() => useTrimRange(1000));

    act(() => {
      result.current.actions.setRange(100, 100 + MIN_TRIM_GAP_MS - 1);
    });

    expect(result.current.range).toBeNull();
  });

  it('re-clamps range when duration changes', () => {
    const { result, rerender } = renderHook(
      ({ duration }) => useTrimRange(duration),
      { initialProps: { duration: 2000 } }
    );

    act(() => {
      result.current.actions.setRange(500, 1800);
    });

    rerender({ duration: 1000 });

    expect(result.current.range).toEqual({ startMs: 500, endMs: 1000 });
  });

  it('setStart and setEnd keep a default gap', () => {
    const { result } = renderHook(() => useTrimRange(2000));

    act(() => {
      result.current.actions.setStart(300);
    });

    expect(result.current.range?.startMs).toBe(300);
    expect(result.current.range?.endMs).toBeGreaterThan(300);

    act(() => {
      result.current.actions.setEnd(1500);
    });

    expect(result.current.range?.endMs).toBe(1500);
  });

  it('clear resets range', () => {
    const { result } = renderHook(() => useTrimRange(1000));

    act(() => {
      result.current.actions.setRange(100, 400);
    });
    expect(result.current.range).not.toBeNull();

    act(() => {
      result.current.actions.clear();
    });

    expect(result.current.range).toBeNull();
  });
});
