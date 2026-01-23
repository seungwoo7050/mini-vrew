import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Caption, VideoId } from '@/data/types';
import { parseCaptions, sortCaptions, toSrt } from './format';
import { useCaptionsQuery, useSaveCaptionsMutation } from './queries';
import styles from './CaptionsPanel.module.css';
import { formatTimecode, parseTimecode } from './time';
import WordEditor from './WordEditor';
import { applySplitCaption, applyMergeCaption } from './captionOps';

function getPlaybackTimeMs(): number | null {
  if (typeof document === 'undefined') return null;
  const videoEl = document.querySelector('video');
  if (!videoEl || !Number.isFinite(videoEl.currentTime)) return null;
  return Math.round(videoEl.currentTime * 1000);
}

function nextId(prefix = 'cap'): string {
  const id =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Date.now().toString(36);
  return `${prefix}_${id}`;
}

function sanitizeCaptions(
  captions: Caption[],
  minDurationMs: number
): Caption[] {
  const filtered = captions.filter((caption) => caption.text.trim().length > 0);
  const mapped = filtered.map((caption) => {
    const start = Math.max(0, caption.startMs);
    const end = Math.max(start + minDurationMs, caption.endMs);
    return { ...caption, startMs: start, endMs: end };
  });
  const sorted = sortCaptions(mapped);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].endMs >= sorted[i + 1].startMs) {
      sorted[i].endMs = sorted[i + 1].startMs - 1;
    }
  }
  return sorted;
}

type Props = {
  videoId: VideoId;
  videoTitle: string;
  currentTimeMs: number;
  onSeek?: (timeMs: number) => void;
};

function CaptionsPanel({ videoId, videoTitle, currentTimeMs, onSeek }: Props) {
  const [defaultDurationMs, setDefaultDurationMs] = useState(2000);
  const [drafts, setDrafts] = useState<Caption[]>([
    {
      id: 'cap_new',
      startMs: 0,
      endMs: 2000,
      text: '',
    },
  ]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWordEditorMode, setIsWordEditorMode] = useState(false);
  const [inputValues, setInputValues] = useState<
    Map<string, { start?: string; end?: string }>
  >(new Map());
  const [focusTextareaId, setFocusTextareaId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const captionsQuery = useCaptionsQuery(videoId);
  const { data, isPending, isError } = captionsQuery;
  const saveMutation = useSaveCaptionsMutation(videoId);
  const saving = saveMutation.isPending;
  const canUseWordEditor = (data?.length ?? 0) > 0;

  const [rawDuration, setRawDuration] = useState<string | undefined>(undefined);

  const formattedDuration = formatTimecode(defaultDurationMs);

  const decreaseDuration = () => {
    setDefaultDurationMs((prev) => Math.max(100, prev - 100));
  };

  const increaseDuration = () => {
    setDefaultDurationMs((prev) => prev + 100);
  };

  useEffect(() => {
    if (data) {
      const populated = data.length
        ? data
        : [
            {
              id: 'cap_new',
              startMs: 0,
              endMs: defaultDurationMs,
              text: '',
            },
          ];
      setDrafts(populated.map((caption) => ({ ...caption })));
    }
  }, [data]);

  useEffect(() => {
    if (!canUseWordEditor && isWordEditorMode) {
      setIsWordEditorMode(false);
    }
  }, [canUseWordEditor, isWordEditorMode]);

  useEffect(() => {
    setDrafts((prev) =>
      prev.map((caption) =>
        caption.text.trim() === ''
          ? { ...caption, endMs: defaultDurationMs }
          : caption
      )
    );
  }, [defaultDurationMs]);

  useEffect(() => {
    if (focusTextareaId) {
      const el = document.querySelector(
        `textarea[data-caption-id="${focusTextareaId}"]`
      ) as HTMLTextAreaElement;
      if (el) {
        el.focus();
        el.select();
      }
      setFocusTextareaId(null);
    }
  }, [focusTextareaId]);

  const heading = useMemo(
    () => (drafts.length ? `자막 ${drafts.length}개` : '자막 없음'),
    [drafts.length]
  );

  const updateField = (id: string, field: keyof Caption, raw: string) => {
    setDrafts((prev) =>
      prev.map((caption) => {
        if (caption.id !== id) return caption;
        if (field === 'text') return { ...caption, text: raw };
        const parsed = parseTimecode(raw);
        if (parsed === null) return caption;
        return {
          ...caption,
          [field]: parsed,
          ...(field === 'startMs' && caption.startMs === 0
            ? { endMs: parsed + defaultDurationMs }
            : {}),
        };
      })
    );
  };

  const handleTimeChange = (
    captionId: string,
    field: 'start' | 'end',
    value: string
  ) => {
    setInputValues((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(captionId) || {};
      newMap.set(captionId, { ...current, [field]: value });
      return newMap;
    });
  };

  const handleTimeBlur = (captionId: string, field: 'start' | 'end') => {
    const raw = inputValues.get(captionId)?.[field];
    if (raw !== undefined) {
      updateField(captionId, field === 'start' ? 'startMs' : 'endMs', raw);
      setInputValues((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(captionId);
        if (current) {
          const newCurrent = { ...current };
          delete newCurrent[field];
          if (Object.keys(newCurrent).length === 0) {
            newMap.delete(captionId);
          } else {
            newMap.set(captionId, newCurrent);
          }
        }
        return newMap;
      });
      if (field === 'start') {
        setInputValues((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(captionId);
          if (current) {
            const newCurrent = { ...current };
            delete newCurrent.end;
            if (Object.keys(newCurrent).length === 0) {
              newMap.delete(captionId);
            } else {
              newMap.set(captionId, newCurrent);
            }
          }
          return newMap;
        });
      }
    }
  };

  const handleTimeKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    captionId: string,
    field: 'start' | 'end'
  ) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const caption = drafts.find((c) => c.id === captionId);
      if (!caption) return;
      const currentMs = field === 'start' ? caption.startMs : caption.endMs;
      const delta = event.key === 'ArrowUp' ? 100 : -100;
      const newMs = Math.max(0, currentMs + delta);
      const newValue = formatTimecode(newMs);
      handleTimeChange(captionId, field, newValue);
      updateField(captionId, field === 'start' ? 'startMs' : 'endMs', newValue);
      if (field === 'start') {
        setInputValues((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(captionId);
          if (current) {
            const newCurrent = { ...current };
            delete newCurrent.end;
            if (Object.keys(newCurrent).length === 0) {
              newMap.delete(captionId);
            } else {
              newMap.set(captionId, newCurrent);
            }
          }
          return newMap;
        });
      }
    }
  };

  const handleTimeDoubleClick = (captionId: string, field: 'start' | 'end') => {
    const playhead = getPlaybackTimeMs();
    if (playhead !== null) {
      const newValue = formatTimecode(playhead);
      handleTimeChange(captionId, field, newValue);
      updateField(captionId, field === 'start' ? 'startMs' : 'endMs', newValue);
      if (field === 'start') {
        setInputValues((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(captionId);
          if (current) {
            const newCurrent = { ...current };
            delete newCurrent.end;
            if (Object.keys(newCurrent).length === 0) {
              newMap.delete(captionId);
            } else {
              newMap.set(captionId, newCurrent);
            }
          }
          return newMap;
        });
      }
    }
  };

  const onUpdateCaption = useCallback((caption: Caption) => {
    setDrafts((prev) => prev.map((c) => (c.id === caption.id ? caption : c)));
  }, []);

  const onSplitCaption = useCallback(
    (captionId: string, wordIndex: number, mode: 'newline' | 'next') => {
      const updated = applySplitCaption(drafts, captionId, wordIndex, mode);
      if (updated) setDrafts(updated);
    },
    [drafts]
  );

  const onMergeCaption = useCallback(
    (captionId: string, direction: 'up' | 'down') => {
      const updated = applyMergeCaption(drafts, captionId, direction);
      if (updated) setDrafts(updated);
    },
    [drafts]
  );

  const handleAdd = (anchorMs?: number | null) => {
    const last = sortCaptions(drafts).at(-1);
    const playhead = anchorMs ?? getPlaybackTimeMs();
    const startMs = Number.isFinite(playhead)
      ? Math.max(0, playhead as number)
      : last
        ? last.endMs + 100
        : 0;
    const endMs = startMs + defaultDurationMs;
    const id = nextId();
    setDrafts([...drafts, { id, startMs, endMs, text: '' }]);
    return id;
  };

  const handleDelete = (id: string) => {
    setDrafts((prev) => {
      if (prev.length === 1) {
        return prev.map((caption) =>
          caption.id === id
            ? {
                ...caption,
                startMs: 0,
                endMs: defaultDurationMs,
                text: '',
                words: undefined,
              }
            : caption
        );
      }
      return prev.filter((cap) => cap.id !== id);
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseCaptions(text);
      if (!parsed.length) {
        setError(
          '유효한 자막을 찾지 못했습니다. 올바른 형식인지 확인해주세요.'
        );
      } else {
        setDrafts(parsed.map((caption) => ({ ...caption, id: nextId() })));
        setMessage(`자막 ${parsed.length}개를 불러왔습니다.`);
      }
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  };

  const handleExport = () => {
    const safe = sanitizeCaptions(drafts, defaultDurationMs);
    setDrafts(safe);
    if (!safe.length) {
      setError('내보낼 자막이 없습니다.');
      return;
    }
    const srt = toSrt(safe);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${videoTitle || 'captions'}.srt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    setMessage(null);
    setError(null);
    const prepared = sanitizeCaptions(drafts, defaultDurationMs);
    const ordered = sortCaptions(prepared);
    for (let i = 1; i < ordered.length; i += 1) {
      if (ordered[i].startMs < ordered[i - 1].endMs) {
        setError('자막 시간이 겹칩니다. 겹치는 구간을 조정해주세요.');
        return;
      }
    }
    setDrafts(prepared);
    try {
      await saveMutation.mutateAsync(prepared);
      setMessage('자막이 저장되었습니다.');
    } catch (e) {
      console.error(e);
      setError('자막 저장 중 오류가 발생했습니다.');
    }
  };

  const handleReset = () => {
    setDrafts(
      data && data.length
        ? data.map((caption) => ({ ...caption }))
        : [
            {
              id: 'cap_new',
              startMs: 0,
              endMs: defaultDurationMs,
              text: '',
            },
          ]
    );
    setMessage(null);
    setError(null);
  };

  const handleTextareaKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
    captionId: string
  ) => {
    if (event.key !== 'Enter') return;
    if (event.nativeEvent.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    updateField(captionId, 'text', event.currentTarget.value);
    const newId = handleAdd(getPlaybackTimeMs());
    setFocusTextareaId(newId);
  };

  if (isPending) {
    return <p className={styles.status}>자막을 불러오는 중...</p>;
  }

  if (isError) {
    return (
      <p className={styles.error}>
        자막을 불러올 수 없습니다. 다시 시도하세요.
      </p>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>{heading}</h3>
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            onClick={() => {
              if (!canUseWordEditor) {
                setError(
                  '자막을 저장한 뒤에 단어 편집기를 사용할 수 있습니다.'
                );
                return;
              }
              setIsWordEditorMode(!isWordEditorMode);
            }}
            disabled={!canUseWordEditor}
            title={
              canUseWordEditor
                ? '단어 편집기 열기'
                : '자막을 저장한 뒤에 사용할 수 있습니다.'
            }
          >
            {isWordEditorMode ? '기본 편집기로 전환' : '단어 편집기로 전환'}
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={() => handleAdd()}
            disabled={saving}
          >
            추가
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={handleImportClick}
            disabled={saving}
          >
            불러오기
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={handleExport}
            disabled={saving}
          >
            내보내기
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={handleReset}
            disabled={saving}
          >
            되돌리기
          </button>
        </div>
        <label className={styles.durationControl}>
          <span>기본 자막 길이(초)</span>
          <div className={styles.durationInputGroup}>
            <input
              className={styles.durationInput}
              type="text"
              value={rawDuration ?? formattedDuration}
              onChange={(event) => setRawDuration(event.target.value)}
              onBlur={() => {
                const trimmed = rawDuration?.trim();
                if (trimmed && trimmed !== '') {
                  const parsed = parseTimecode(trimmed);
                  if (parsed !== null) {
                    setDefaultDurationMs(parsed);
                    setRawDuration(undefined);
                  }
                  // 실패 시 유지
                }
                // 빈 칸 시 유지
              }}
            />
            <button
              className={styles.durationButton}
              type="button"
              onClick={increaseDuration}
            >
              +
            </button>
            <button
              className={styles.durationButton}
              type="button"
              onClick={decreaseDuration}
            >
              -
            </button>
          </div>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,.txt"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      <p className={styles.hint}>
        시간은 HH:MM:SS,mmm 또는 HH:MM:SS.mmm 형식을 지원합니다.
      </p>

      {isWordEditorMode && canUseWordEditor ? (
        <WordEditor
          captions={drafts}
          currentTimeMs={currentTimeMs}
          onUpdateCaption={onUpdateCaption}
          onSplitCaption={onSplitCaption}
          onMergeCaption={onMergeCaption}
          onDeleteCaption={handleDelete}
          onSeek={onSeek}
        />
      ) : (
        <div className={styles.list}>
          {drafts.map((caption) => {
            const isActive =
              currentTimeMs >= caption.startMs && currentTimeMs < caption.endMs;
            return (
              <div
                key={caption.id}
                className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
              >
                <input
                  key={`${caption.id}-start`}
                  className={styles.input}
                  type="text"
                  value={
                    inputValues.get(caption.id)?.start ??
                    formatTimecode(caption.startMs)
                  }
                  aria-label="시작 시간"
                  onChange={(e) =>
                    handleTimeChange(caption.id, 'start', e.target.value)
                  }
                  onBlur={() => handleTimeBlur(caption.id, 'start')}
                  onKeyDown={(e) => handleTimeKeyDown(e, caption.id, 'start')}
                  onDoubleClick={() =>
                    handleTimeDoubleClick(caption.id, 'start')
                  }
                />
                <input
                  key={`${caption.id}-end`}
                  className={styles.input}
                  type="text"
                  value={
                    inputValues.get(caption.id)?.end ??
                    formatTimecode(caption.endMs)
                  }
                  aria-label="종료 시간"
                  onChange={(e) =>
                    handleTimeChange(caption.id, 'end', e.target.value)
                  }
                  onBlur={() => handleTimeBlur(caption.id, 'end')}
                  onKeyDown={(e) => handleTimeKeyDown(e, caption.id, 'end')}
                  onDoubleClick={() => handleTimeDoubleClick(caption.id, 'end')}
                />
                <button
                  className={styles.smallButton}
                  type="button"
                  onClick={() => handleDelete(caption.id)}
                  disabled={saving}
                >
                  삭제
                </button>
                <textarea
                  key={`${caption.id}-text`}
                  className={styles.textarea}
                  value={caption.text}
                  aria-label="자막 내용"
                  data-caption-id={caption.id}
                  onChange={(e) =>
                    updateField(caption.id, 'text', e.target.value)
                  }
                  onKeyDown={(e) => handleTextareaKeyDown(e, caption.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {message && <p className={styles.status}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

export default CaptionsPanel;
