export type ApiMode = 'local' | 'http';

type Brand<T, B> = T & { __brand: B };
export type VideoId = Brand<string, 'VideoId'>;
export type CaptionId = Brand<string, 'CaptionId'>;

export const createVideoId = (id: string): VideoId => id as VideoId;
export const createCaptionId = (id: string): CaptionId => id as CaptionId;

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

export type CaptionWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type Caption = {
  id: CaptionId;
  startMs: number;
  endMs: number;
  text: string;
  words?: CaptionWord[];
};

export type CreateVideoInput = {
  title: string;
  id?: VideoId;
  createdAt?: number;
};
