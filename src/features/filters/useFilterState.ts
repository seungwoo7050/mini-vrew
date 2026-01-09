import { useCallback, useState } from 'react';

export type FilterState = {
  filters: {
    grayscale: { enabled: boolean; amount: number };
    brightness: { enabled: boolean; amount: number };
    contrast: { enabled: boolean; amount: number };
  };
};

export type FilterActions = {
  toggleGrayscale: () => void;
  setGrayscaleAmount: (amount: number) => void;
  toggleBrightness: () => void;
  setBrightnessAmount: (amount: number) => void;
  toggleContrast: () => void;
  setContrastAmount: (amount: number) => void;
  reset: () => void;
};

export function useFilterState() {
  const [filters, setFilters] = useState<FilterState['filters']>({
    grayscale: { enabled: false, amount: 0 },
    brightness: { enabled: false, amount: 0 },
    contrast: { enabled: false, amount: 0 },
  });

  const toggleGrayscale = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      grayscale: { ...prev.grayscale, enabled: !prev.grayscale.enabled },
    }));
  }, []);

  const setGrayscaleAmount = useCallback((amount: number) => {
    setFilters((prev) => ({
      ...prev,
      grayscale: {
        ...prev.grayscale,
        amount: Math.max(0, Math.min(1, amount)),
      },
    }));
  }, []);

  const toggleBrightness = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      brightness: { ...prev.brightness, enabled: !prev.brightness.enabled },
    }));
  }, []);

  const setBrightnessAmount = useCallback((amount: number) => {
    setFilters((prev) => ({
      ...prev,
      brightness: {
        ...prev.brightness,
        amount: Math.max(-1, Math.min(1, amount)),
      },
    }));
  }, []);

  const toggleContrast = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      contrast: { ...prev.contrast, enabled: !prev.contrast.enabled },
    }));
  }, []);

  const setContrastAmount = useCallback((amount: number) => {
    setFilters((prev) => ({
      ...prev,
      contrast: { ...prev.contrast, amount: Math.max(-1, Math.min(1, amount)) },
    }));
  }, []);

  const reset = useCallback(() => {
    setFilters({
      grayscale: { enabled: false, amount: 0 },
      brightness: { enabled: false, amount: 0 },
      contrast: { enabled: false, amount: 0 },
    });
  }, []);

  const state: FilterState = { filters };
  const actions: FilterActions = {
    toggleGrayscale,
    setGrayscaleAmount,
    toggleBrightness,
    setBrightnessAmount,
    toggleContrast,
    setContrastAmount,
    reset,
  };

  return { state, actions } as const;
}
