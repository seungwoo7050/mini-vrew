import styles from './ThumbnailPreview.module.css';

type ThumbnailPreviewProps = {
  src: string | null;
  alt: string;
  emptyLabel: string;
  className?: string;
};

function ThumbnailPreview({
  src,
  alt,
  emptyLabel,
  className,
}: ThumbnailPreviewProps) {
  const wrapperClassName = [styles.wrapper, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClassName} aria-label={alt}>
      {src ? (
        <img className={styles.image} src={src} alt={alt} />
      ) : (
        <div className={styles.fallback}>{emptyLabel}</div>
      )}
    </div>
  );
}

export default ThumbnailPreview;
