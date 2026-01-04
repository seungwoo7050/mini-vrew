import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Caption, CaptionWord } from '@/data/types';
import { computeFallbackWordTimings } from './wordHighlight';
import styles from './WordEditor.module.css';

type Props = {
  captions: Caption[];
  currentTimeMs: number;
  onUpdateCaption: (caption: Caption) => void;
  onSeek?: (timeMs: number) => void;
  className?: string;
};

function getCaptionWords(caption: Caption): CaptionWord[] {
  return computeFallbackWordTimings(caption);
}

function WordEditor({
  captions,
  currentTimeMs,
  onUpdateCaption,
  onSeek,
  className,
}: Props) {
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(
    null
  );
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(
    null
  );
  const [editingWord, setEditingWord] = useState<{
    captionId: string;
    index: number;
  } | null>(null);
  const [editText, setEditText] = useState('');

  const editInputRef = useRef<HTMLInputElement>(null);

  const activeCaptionId = useMemo(() => {
    const found = captions.find(
      (c) => currentTimeMs >= c.startMs && currentTimeMs < c.endMs
    );
    return found?.id ?? null;
  }, [captions, currentTimeMs]);

  const effectiveSelectedCaptionId = useMemo(() => {
    if (selectedCaptionId) return selectedCaptionId;
    return activeCaptionId;
  }, [selectedCaptionId, activeCaptionId]);

  useEffect(() => {
    if (editingWord && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingWord]);

  const handleWordClick = useCallback(
    (captionId: string, wordIndex: number, word: CaptionWord) => {
      setSelectedCaptionId(captionId);
      setSelectedWordIndex(wordIndex);

      if (onSeek) {
        onSeek(word.startMs);
      }
    },
    [onSeek]
  );

  const handleWordDoubleClick = useCallback(
    (captionId: string, wordIndex: number, word: CaptionWord) => {
      setEditingWord({ captionId, index: wordIndex });
      setEditText(word.text);
    },
    []
  );

  const handleEditSubmit = useCallback(() => {
    if (!editingWord || !editText.trim()) {
      setEditingWord(null);
      return;
    }

    const caption = captions.find((c) => c.id === editingWord.captionId);
    if (!caption) {
      setEditingWord(null);
      return;
    }

    const words = getCaptionWords(caption);
    const newWords = words.map((w, i) =>
      i === editingWord.index ? { ...w, text: editText.trim() } : w
    );

    const newText = newWords.map((w) => w.text).join(' ');

    onUpdateCaption({
      ...caption,
      text: newText,
      words: newWords,
    });

    setEditingWord(null);
  }, [editingWord, editText, captions, onUpdateCaption]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEditSubmit();
      } else if (e.key === 'Escape') {
        setEditingWord(null);
      }
    },
    [handleEditSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingWord) return;

      const caption = captions.find((c) => c.id === effectiveSelectedCaptionId);
      if (!caption) return;

      const words = getCaptionWords(caption);
      const currentIndex = selectedWordIndex ?? -1;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            setSelectedWordIndex(newIndex);
            if (onSeek) {
              onSeek(words[newIndex].startMs);
            }
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < words.length - 1) {
            const newIndex = currentIndex + 1;
            setSelectedWordIndex(newIndex);
            if (onSeek) {
              onSeek(words[newIndex].startMs);
            }
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const currentCaptionIdx = captions.findIndex(
              (c) => c.id === effectiveSelectedCaptionId
            );
            if (currentCaptionIdx > 0) {
              const prevCaption = captions[currentCaptionIdx - 1];
              setSelectedCaptionId(prevCaption.id);
              setSelectedWordIndex(0);
              if (onSeek) {
                onSeek(prevCaption.startMs);
              }
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const currentCaptionIdx = captions.findIndex(
              (c) => c.id === effectiveSelectedCaptionId
            );
            if (currentCaptionIdx < captions.length - 1) {
              const nextCaption = captions[currentCaptionIdx + 1];
              setSelectedCaptionId(nextCaption.id);
              setSelectedWordIndex(0);
              if (onSeek) {
                onSeek(nextCaption.startMs);
              }
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (
            currentIndex >= 0 &&
            currentIndex < words.length &&
            effectiveSelectedCaptionId
          ) {
            handleWordDoubleClick(
              effectiveSelectedCaptionId,
              currentIndex,
              words[currentIndex]
            );
          }
          break;
        default:
          break;
      }
    },
    [
      editingWord,
      captions,
      effectiveSelectedCaptionId,
      selectedWordIndex,
      onSeek,
      handleWordDoubleClick,
    ]
  );

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const milli = ms % 1000;
    return `${m}:${sec.toString().padStart(2, '0')}.${Math.floor(milli / 100)}`;
  };

  if (captions.length === 0) {
    return (
      <div className={`${styles.editor} ${className ?? ''}`}>
        <div className={styles.emptyState}>
          자막이 없습니다. 자막 패널에서 자막을 추가하세요.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.editor} ${className ?? ''}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="단어 편집기"
    >
      <div className={styles.header}>
        <h4 className={styles.title}>단어 편집</h4>
        <p className={styles.keyboardHint}>
          방향키: 이동 | Enter: 편집 | 클릭: 해당 위치로 이동
        </p>
      </div>

      {captions.map((caption) => {
        const words = getCaptionWords(caption);
        const isActive = caption.id === activeCaptionId;
        const isSelected = caption.id === effectiveSelectedCaptionId;

        return (
          <div
            key={caption.id}
            className={`${styles.captionRow} ${isActive ? styles.captionRowActive : ''}`}
            onClick={() => setSelectedCaptionId(caption.id)}
          >
            <div className={styles.captionHeader}>
              <span className={styles.captionTime}>
                {formatTime(caption.startMs)} → {formatTime(caption.endMs)}
              </span>
            </div>

            <div className={styles.wordList}>
              {words.map((word, idx) => {
                const isWordSelected = isSelected && selectedWordIndex === idx;
                const isEditing =
                  editingWord?.captionId === caption.id &&
                  editingWord?.index === idx;
                const isWordActive =
                  currentTimeMs >= word.startMs && currentTimeMs < word.endMs;

                if (isEditing) {
                  return (
                    <div
                      key={`${caption.id}-word-${idx}`}
                      className={styles.wordEditContainer}
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        className={styles.wordInput}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={handleEditSubmit}
                        onKeyDown={handleEditKeyDown}
                      />
                    </div>
                  );
                }

                return (
                  <button
                    key={`${caption.id}-word-${idx}`}
                    type="button"
                    className={`${styles.word} ${isWordActive ? styles.wordActive : ''} ${isWordSelected ? styles.wordSelected : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWordClick(caption.id, idx, word);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleWordDoubleClick(caption.id, idx, word);
                    }}
                    title={`${formatTime(word.startMs)} - ${formatTime(word.endMs)}`}
                  >
                    {word.text}
                  </button>
                );
              })}
            </div>

            {isSelected && words.length > 0 && (
              <div className={styles.timelineStrip}>
                {words.map((word, idx) => {
                  const captionDuration = caption.endMs - caption.startMs;
                  if (captionDuration <= 0) return null;

                  const left =
                    ((word.startMs - caption.startMs) / captionDuration) * 100;
                  const width =
                    ((word.endMs - word.startMs) / captionDuration) * 100;

                  return (
                    <div
                      key={`timeline-${caption.id}-${idx}`}
                      className={styles.timelineWord}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 2)}%`,
                      }}
                      title={word.text}
                    >
                      {width > 8 ? word.text : ''}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WordEditor;
