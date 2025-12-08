import type { ChangeEvent, FormEvent } from 'react';
import { useMemo, useState } from 'react';

import { useUploadVideo } from '@/features/upload/useUploadVideo';

import styles from './UploadPage.module.css';

type SelectableFile = File | null;

function UploadPage() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<SelectableFile>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync, isPending, isSuccess, data } = useUploadVideo();

  const uploadTitle = useMemo(() => title.trim(), [title]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    setFile(selected || null);
  };

  const handleSumbit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }
    setError(null);
    try {
      await mutateAsync({ title: uploadTitle || file.name, file });
      setTitle('');
      setFile(null);
    } catch (e) {
      setError('업로드 중 오류가 발생했습니다. 다시 시도해주세요.');
      console.error('[Upload error]:', e);
    }
  };

  return (
    <section className={styles.page}>
      <div>
        <h1 className={styles.title}>비디오 업로드</h1>
        <p className={styles.subtitle}>
          로컬 비디오를 업로드하고 IndexedDB에 안전하게 저장합니다.
        </p>
      </div>
      <div className={styles.steps}>
        <span>1) 제목과 파일을 선택합니다.</span>
        <span>2) 썸네일을 생성해 미리 봅니다 (현재는 stub).</span>
        <span>3) 업로드 후 목록에서 바로 확인합니다.</span>
      </div>

      <form className={styles.form} onSubmit={handleSumbit}>
        <label className={styles.label}>
          제목
          <input
            className={styles.input}
            type="text"
            name="title"
            placeholder="예) 취업을 위한 프로젝트 소개 영상"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
          />
        </label>

        <label className={styles.label}>
          비디오 파일
          <input
            className={styles.input}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            disabled={isPending}
          />
        </label>

        <div className={styles.actions}>
          <button className={styles.button} type="submit" disabled={isPending}>
            {isPending ? '업로드 중...' : '업로드'}
          </button>
          {file && <span className={styles.fileName}>{file.name}</span>}
        </div>
      </form>

      {error && <div className={styles.error}>{error}</div>}
      {isSuccess && data && (
        <p className={styles.success}>업로드 완료: {data.title}</p>
      )}
    </section>
  );
}

export default UploadPage;
