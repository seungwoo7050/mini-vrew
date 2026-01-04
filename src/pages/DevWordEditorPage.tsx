import { useState } from 'react';

import WordEditor from '@/features/captions/WordEditor';
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
        onSeek={(t) => setCurrentTimeMs(t)}
      />
    </div>
  );
}
