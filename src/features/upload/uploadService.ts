function buildPlaceholderText(fileName: string) {
  const timestamp = new Date().toISOString();
  return `thumbnail placeholder for ${fileName} at ${timestamp}`;
}

export async function createThumbnailPlaceholder(file: File): Promise<Blob> {
  const text = buildPlaceholderText(file.name);
  return new Blob([text], { type: 'image/png' });
}
