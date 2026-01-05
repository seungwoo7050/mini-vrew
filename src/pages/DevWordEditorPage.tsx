import { useState, useCallback } from 'react';

import WordEditor from '@/features/captions/WordEditor';
import { applySplitCaption } from '@/features/captions/captionOps';
import type { Caption } from '@/data/types';

const sampleCaptions: Caption[] = [
  { id: 'c1', startMs: 0, endMs: 4000, text: 'Hello world this is a test' },
  { id: 'c2', startMs: 4000, endMs: 8000, text: 'Another caption for preview' },
];

export default function DevWordEditorPage() {
  const [captions, setCaptions] = useState<Caption[]>(sampleCaptions);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  const onUpdateCaption = (caption: Caption) => {
    setCaptions((prev) => prev.map((c) => (c.id === caption.id ? caption : c)));
    console.log('Updated caption:', caption);
  };

  const onSplitCaption = useCallback(
    (captionId: string, wordIndex: number, mode: 'newline' | 'next') => {
      const updated = applySplitCaption(captions, captionId, wordIndex, mode);
      if (updated) setCaptions(updated);
    },
    [captions]
  );

  return (
    <div style={{ padding: 16 }}>
      <h2>Dev: WordEditor 🔧</h2>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Current time: <strong>{currentTimeMs} ms</strong>
        </label>
        <input
          type="range"
          min={0}
          max={8000}
          value={currentTimeMs}
          onChange={(e) => setCurrentTimeMs(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <WordEditor
        captions={captions}
        currentTimeMs={currentTimeMs}
        onUpdateCaption={onUpdateCaption}
        onSplitCaption={onSplitCaption}
        onSeek={(t) => setCurrentTimeMs(t)}
      />

      <div
        style={{
          marginTop: 16,
          padding: 12,
          background: '#fafafa',
          borderRadius: 6,
        }}
      >
        <h3 style={{ margin: '0 0 8px 0' }}>Captions (debug) 🔍</h3>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            background: '#fff',
            padding: 8,
            border: '1px solid #eee',
          }}
        >
          {JSON.stringify(captions, null, 2)}
        </pre>

        {captions.map((c) => (
          <div
            key={c.id}
            style={{
              marginTop: 8,
              padding: 8,
              border: '1px solid #eee',
              borderRadius: 4,
              background: '#fff',
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {c.id} — {c.startMs}ms → {c.endMs}ms
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0 0' }}>
              {c.text}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
