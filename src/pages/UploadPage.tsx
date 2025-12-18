import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useUploadVideo } from '@/features/upload/useUploadVideo';

import styles from './UploadPage.module.css';
import { createThumbnailForUpload } from '@/features/upload/uploadService';

type SelectableFile = File | null;

function UploadPage() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<SelectableFile>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbChoice, setThumbChoice] = useState<'jpeg' | 'png'>('jpeg');
  const [jpegQuality, setJpegQuality] = useState(0.92);
  const [atSeconds, setAtSeconds] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number | null>(0);
  const [thumbnails, setThumbnails] = useState<{
    jpeg: string | null;
    png: string | null;
  }>({ jpeg: null, png: null });

  const navigate = useNavigate();

  const { mutateAsync, isPending, isSuccess, data } = useUploadVideo();
  const uploadTitle = useMemo(() => title.trim(), [title]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    setFile(selected || null);
    if (selected) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(selected);
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
        URL.revokeObjectURL(video.src);
      };

      try {
        const thumbs = await createThumbnailForUpload(selected, {
          quality: jpegQuality,
          atSeconds: atSeconds || 0.5,
        });
        setThumbnails({
          jpeg: URL.createObjectURL(thumbs.jpeg.blob),
          png: URL.createObjectURL(thumbs.png.blob),
        });
      } catch (e) {
        console.error('썸네일 생성 실패:', e);
        setThumbnails({ jpeg: null, png: null });
      }
    } else {
      setVideoDuration(null);
      setThumbnails({ jpeg: null, png: null });
      setAtSeconds(0);
    }
  };

  const handleSumbit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }
    setError(null);
    try {
      await mutateAsync({
        title: uploadTitle || file.name,
        file,
        thumbChoice,
        jpegQuality,
        atSeconds,
      });
      setTitle('');
      setFile(null);
      setThumbnails({ jpeg: null, png: null });
    } catch (e) {
      setError('업로드 중 오류가 발생했습니다. 다시 시도해주세요.');
      console.error('[Upload error]:', e);
    }
  };

  useEffect(() => {
    if (isSuccess && data?.videoId) {
      navigate(`/videos/${data.videoId}`, { replace: true });
    }
  }, [data?.videoId, isSuccess, data, navigate]);

  useEffect(() => {
    if (file && atSeconds > 0) {
      createThumbnailForUpload(file, { quality: jpegQuality, atSeconds })
        .then((thumbs) => {
          setThumbnails({
            jpeg: URL.createObjectURL(thumbs.jpeg.blob),
            png: URL.createObjectURL(thumbs.png.blob),
          });
        })
        .catch((e) => {
          console.error('썸네일 재생성 실패:', e);
        });
    }
  }, [atSeconds, file, jpegQuality]);

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

        {file && thumbnails.jpeg && thumbnails.png && videoDuration && (
          <div className={styles.thumbnailSection}>
            <h3 className={styles.subtitle}>생성된 썸네일 미리보기</h3>
            <div className={styles.timeControl}>
              <label htmlFor="atSeconds" className={styles.thumbLabel}>
                썸네일 캡처 시점: {atSeconds.toFixed(1)}s /{' '}
                {videoDuration.toFixed(1)}s
              </label>
              <input
                id="atSeconds"
                type="range"
                min={0}
                max={videoDuration}
                step={0.1}
                value={atSeconds}
                onChange={(e) => setAtSeconds(parseFloat(e.target.value))}
                disabled={isPending}
                className={styles.timeSlider}
              />
            </div>
            <div className={styles.thumbnailOptions}>
              <label className={styles.thumbnailOption}>
                <input
                  type="radio"
                  value="jpeg"
                  checked={thumbChoice === 'jpeg'}
                  onChange={() => setThumbChoice('jpeg')}
                  disabled={isPending}
                />
                JPEG
                <img
                  src={thumbnails.jpeg}
                  alt="JPEG 썸네일"
                  className={styles.thumbnailPreview}
                />
              </label>
              <label className={styles.thumbnailOption}>
                <input
                  type="radio"
                  value="png"
                  checked={thumbChoice === 'png'}
                  onChange={() => setThumbChoice('png')}
                  disabled={isPending}
                />
                PNG
                <img
                  src={thumbnails.png}
                  alt="PNG 썸네일"
                  className={styles.thumbnailPreview}
                />
              </label>
            </div>
            {thumbChoice === 'jpeg' && (
              <div className={styles.qualityControl}>
                <label htmlFor="jpegQuality" className={styles.thumbLabel}>
                  JPEG 품질: {(jpegQuality * 100).toFixed(0)}%
                </label>
                <input
                  id="jpegQuality"
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.01}
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(parseFloat(e.target.value))}
                  className={styles.qualitySlider}
                />
              </div>
            )}
          </div>
        )}

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
