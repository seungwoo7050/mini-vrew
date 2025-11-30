export type ApiMode = 'local' | 'http';

export type VideoId = string;
export type CaptionId = string;

export type Video = {
  id: VideoId;
  title: string;
  createdAt: number;
  durationMs?: number;
  width?: number;
  height?: number;
};

export type VideoMetadataPatch = Partial<
  Pick<Video, 'durationMs' | 'width' | 'height'>
>;

export type Caption = {
  id: CaptionId;
  startMs: number;
  endMs: number;
  text: string;
};

export type CreateVideoInput = {
  title: string;
  id?: VideoId;
  createdAt?: number;
};
