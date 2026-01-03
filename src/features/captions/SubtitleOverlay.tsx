import { useMemo } from 'react';

import type { Caption } from '@/data/types';
import { findActiveCaptionAndWord } from './wordHighlight';
import styles from './SubtitleOverlay.module.css';

type Props = {
  captions: Caption[];
  currentTimeMs: number;
  onWordClick?: (timeMs: number) => void;
};

function SubtitleOverlay({ captions, currentTimeMs, onWordClick }: Props) {
  const active = useMemo(
    () => findActiveCaptionAndWord(captions, currentTimeMs),
    [captions, currentTimeMs]
  );

  if (!active) return null;

  const { words, activeWordIndex } = active;

  return (
    <div className={styles.overlay} aria-live="polite">
      <div className={styles.captionBox}>
        {words.map((word, index) => (
          <span
            key={`${word.startMs}-${index}`}
            className={`${styles.word} ${index === activeWordIndex ? styles.activeWord : ''}`}
            onClick={() => onWordClick?.(word.startMs)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onWordClick?.(word.startMs);
              }
            }}
            role="button"
            tabIndex={0}
          >
            {word.text}
          </span>
        ))}
      </div>
    </div>
  );
}

export default SubtitleOverlay;
