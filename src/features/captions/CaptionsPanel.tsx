import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Caption, VideoId } from '@/data/types';
import { parseCaptions, sortCaptions, toSrt } from './format';
import { useCaptionsQuery, useSaveCaptionsMutation } from './queries';
import styles from './CaptionsPanel.module.css';
import { formatTimecode, parseTimecode } from './time';
import WordEditor from './WordEditor';
import { applySplitCaption, applyMergeCaption } from './captionOps';

const EMPTY_CAPTION: Caption = {
  id: 'cap_new',
  startMs: 0,
  endMs: 2000,
  text: '',
};

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

function sanitizeCaptions(captions: Caption[]): Caption[] {
  return sortCaptions(
    captions
      .filter((caption) => caption.text.trim().length > 0)
      .map((caption) => {
        const start = Math.max(0, caption.startMs);
        const end = Math.max(start + 2000, caption.endMs);
        return { ...caption, startMs: start, endMs: end };
      })
  );
}

type Props = {
  videoId: VideoId;
  videoTitle: string;
  currentTimeMs: number;
  onSeek?: (timeMs: number) => void;
};

function CaptionsPanel({ videoId, videoTitle, currentTimeMs, onSeek }: Props) {
  const [drafts, setDrafts] = useState<Caption[]>([EMPTY_CAPTION]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWordEditorMode, setIsWordEditorMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const captionsQuery = useCaptionsQuery(videoId);
  const { data, isPending, isError } = captionsQuery;
  const saveMutation = useSaveCaptionsMutation(videoId);
  const saving = saveMutation.isPending;

  useEffect(() => {
    if (data) {
      const populated = data.length ? data : [EMPTY_CAPTION];
      setDrafts(populated.map((caption) => ({ ...caption })));
    }
  }, [data]);

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
        return parsed === null ? caption : { ...caption, [field]: parsed };
      })
    );
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
    const endMs = startMs + 2000;
    const id = nextId();
    setDrafts([...drafts, { ...EMPTY_CAPTION, id, startMs, endMs }]);
    return id;
  };

  const handleDelete = (id: string) => {
    setDrafts((prev) => {
      if (prev.length === 1) return prev;
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
    const safe = sanitizeCaptions(drafts);
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
    const prepared = sanitizeCaptions(drafts);
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
        : [EMPTY_CAPTION]
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
    return newId;
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
            onClick={() => setIsWordEditorMode(!isWordEditorMode)}
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

      {isWordEditorMode ? (
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
                  key={`${caption.id}-start-${caption.startMs}`}
                  className={styles.input}
                  type="text"
                  value={formatTimecode(caption.startMs)}
                  aria-label="시작 시간"
                  onChange={(e) =>
                    updateField(caption.id, 'startMs', e.target.value)
                  }
                />
                <input
                  key={`${caption.id}-end-${caption.endMs}`}
                  className={styles.input}
                  type="text"
                  value={formatTimecode(caption.endMs)}
                  aria-label="종료 시간"
                  onChange={(e) =>
                    updateField(caption.id, 'endMs', e.target.value)
                  }
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
