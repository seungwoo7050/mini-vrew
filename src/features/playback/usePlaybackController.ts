import { useCallback, useEffect, useRef, useState } from 'react';

export type PlaybackView = {
  isReady: boolean;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number | null;
};

export type PlaybackActions = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (timeMs: number) => void;
  setLoopRange: (range: { startMs: number; endMs: number } | null) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setSeekGuardsEnabled: (enabled: boolean) => void;
};

export type PlaybackController = {
  videoRef: (el: HTMLVideoElement | null) => void;
  view: PlaybackView;
  actions: PlaybackActions;
};

type Args = {
  resetKey: string;
  onLoadedMetadata?: (el: HTMLVideoElement) => void;
};

const PLAYHEAD_STEP_MS = 33;

export function usePlaybackController({
  resetKey,
  onLoadedMetadata,
}: Args): PlaybackController {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const playheadRafIdRef = useRef<number | null>(null);
  const loopRangeRef = useRef<{ startMs: number; endMs: number } | null>(null);
  const loopEnabledRef = useRef(true);
  const seekGuardsEnabledRef = useRef(true);

  const updateCurrentTimeMs = useCallback(
    (el: HTMLVideoElement, quantize = true) => {
      const t = el.currentTime;
      if (!Number.isFinite(t)) return;

      const ms = Math.round(t * 1000);
      const next = quantize
        ? Math.round(ms / PLAYHEAD_STEP_MS) * PLAYHEAD_STEP_MS
        : ms;
      setCurrentTimeMs((prev) => (prev !== next ? next : prev));
    },
    []
  );

  const stopPlayheadTick = useCallback(() => {
    if (playheadRafIdRef.current !== null) {
      cancelAnimationFrame(playheadRafIdRef.current);
      playheadRafIdRef.current = null;
    }
  }, []);

  const startPlayheadTick = useCallback(
    (el: HTMLVideoElement) => {
      if (playheadRafIdRef.current !== null) return;

      const tick = () => {
        if (el.paused) {
          stopPlayheadTick();
          return;
        }

        const t = el.currentTime;
        if (Number.isFinite(t)) {
          const ms = Math.round(t * 1000);

          if (loopEnabledRef.current && loopRangeRef.current) {
            const { startMs, endMs } = loopRangeRef.current;
            if (ms >= endMs) {
              el.currentTime = startMs / 1000;
              setCurrentTimeMs(startMs);
              playheadRafIdRef.current = requestAnimationFrame(tick);
              return;
            }
          }

          updateCurrentTimeMs(el, true);
        }

        playheadRafIdRef.current = requestAnimationFrame(tick);
      };

      playheadRafIdRef.current = requestAnimationFrame(tick);
    },
    [stopPlayheadTick]
  );

  const resetState = useCallback(() => {
    setIsReady(false);
    setDurationMs(null);
    setCurrentTimeMs(0);
    setIsPlaying(false);
    stopPlayheadTick();
    videoElRef.current?.pause();
  }, [stopPlayheadTick]);

  useEffect(() => {
    resetState();
  }, [resetKey, resetState]);

  const videoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      const prev = videoElRef.current;
      videoElRef.current = el;

      if (prev && prev !== el) {
        prev.pause();
        stopPlayheadTick();
      }

      if (!el) return;

      const handleLoadedMetadata = () => {
        const duration = el.duration;
        if (Number.isFinite(duration)) {
          setDurationMs(Math.round(duration * 1000));
        }
        setIsReady(true);
        onLoadedMetadata?.(el);
      };

      const handlePlay = () => {
        setIsPlaying(true);
        startPlayheadTick(el);
      };

      const handlePause = () => {
        setIsPlaying(false);
        stopPlayheadTick();
      };

      const handleEnded = () => {
        setIsPlaying(false);
        stopPlayheadTick();
      };

      const handleTimeUpdate = () => {
        if (!el.paused) return;
        updateCurrentTimeMs(el, false);
      };

      const handleSeeking = () => {
        if (!el.paused) return;
        updateCurrentTimeMs(el, false);
      };

      const handleSeeked = () => {
        if (!el.paused) return;
        updateCurrentTimeMs(el, false);
      };

      el.addEventListener('loadedmetadata', handleLoadedMetadata);
      el.addEventListener('play', handlePlay);
      el.addEventListener('pause', handlePause);
      el.addEventListener('ended', handleEnded);
      el.addEventListener('timeupdate', handleTimeUpdate);
      el.addEventListener('seeking', handleSeeking);
      el.addEventListener('seeked', handleSeeked);

      if (el.readyState >= 1) {
        handleLoadedMetadata();
      }

      return () => {
        el.removeEventListener('loadedmetadata', handleLoadedMetadata);
        el.removeEventListener('play', handlePlay);
        el.removeEventListener('pause', handlePause);
        el.removeEventListener('ended', handleEnded);
        el.removeEventListener('timeupdate', handleTimeUpdate);
        el.removeEventListener('seeking', handleSeeking);
        el.removeEventListener('seeked', handleSeeked);
      };
    },
    [onLoadedMetadata, startPlayheadTick, stopPlayheadTick, updateCurrentTimeMs]
  );

  const play = useCallback(() => {
    const el = videoElRef.current;
    if (!el || !isReady) return;

    if (seekGuardsEnabledRef.current && loopRangeRef.current) {
      const ms = Math.round(el.currentTime * 1000);
      const { startMs, endMs } = loopRangeRef.current;
      if (ms < startMs || ms >= endMs) {
        el.currentTime = startMs / 1000;
      }
    }

    setIsPlaying(true);
    startPlayheadTick(el);

    const p = el.play();
    if (p && typeof (p as Promise<unknown>).catch === 'function') {
      (p as Promise<unknown>).catch(() => {
        setIsPlaying(false);
        stopPlayheadTick();
      });
    }
  }, [isReady, startPlayheadTick, stopPlayheadTick]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    stopPlayheadTick();
    videoElRef.current?.pause();
  }, [stopPlayheadTick]);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const seek = useCallback(
    (timeMs: number) => {
      const el = videoElRef.current;
      if (!el) return;

      const clampedByDuration =
        durationMs != null ? Math.max(0, Math.min(timeMs, durationMs)) : timeMs;
      const guarded = (() => {
        if (seekGuardsEnabledRef.current && loopRangeRef.current) {
          const { startMs, endMs } = loopRangeRef.current;
          return Math.max(startMs, Math.min(clampedByDuration, endMs));
        }
        return clampedByDuration;
      })();

      el.currentTime = guarded / 1000;
      setCurrentTimeMs(guarded);
    },
    [durationMs]
  );

  const setLoopRange = useCallback(
    (range: { startMs: number; endMs: number } | null) => {
      loopRangeRef.current = range;
    },
    []
  );

  const setLoopEnabled = useCallback((enabled: boolean) => {
    loopEnabledRef.current = enabled;
  }, []);

  const setSeekGuardsEnabled = useCallback((enabled: boolean) => {
    seekGuardsEnabledRef.current = enabled;
  }, []);

  return {
    videoRef,
    view: {
      isReady,
      isPlaying,
      currentTimeMs,
      durationMs,
    },
    actions: {
      play,
      pause,
      toggle,
      seek,
      setLoopRange,
      setLoopEnabled,
      setSeekGuardsEnabled,
    },
  };
}
