import { useMutation, useQueryClient } from '@tanstack/react-query';

import { appApi } from '@/data/createAppApi';
import {
  thumbnailBlobKey,
  videoBlobKey,
  videoKey,
  videosKey,
} from '@/data/queryKeys';
import type { CreateVideoInput, VideoId } from '@/data/types';
import { createThumbnailForUpload } from './uploadService';

export type UploadPayload = {
  title: string;
  file: File;
  thumbChoice?: 'jpeg' | 'png';
  jpegQuality?: number;
  atSeconds?: number;
};

type Created = {
  videoId: VideoId;
  title: string;
};

async function createVideoWithAssets(payload: UploadPayload): Promise<Created> {
  const input: CreateVideoInput = {
    title: payload.title.trim() || payload.file.name,
  };

  const video = await appApi.createVideo(input);
  await appApi.putVideoBlob(video.id, payload.file);
  const thumb = await createThumbnailForUpload(payload.file, {
    quality: payload.jpegQuality,
    atSeconds: payload.atSeconds,
  });
  const selectedThumb = payload.thumbChoice === 'png' ? thumb.png : thumb.jpeg;
  await appApi.putThumbnailBlob(video.id, selectedThumb.blob);
  if (selectedThumb.width || selectedThumb.height) {
    await appApi.updateVideoMetadata(video.id, {
      width: selectedThumb.width,
      height: selectedThumb.height,
    });
  }
  return { videoId: video.id, title: video.title };
}

export function useUploadVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVideoWithAssets,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: videosKey });
      queryClient.invalidateQueries({ queryKey: videoKey(created.videoId) });
      queryClient.invalidateQueries({
        queryKey: videoBlobKey(created.videoId),
      });
      queryClient.invalidateQueries({
        queryKey: thumbnailBlobKey(created.videoId),
      });
    },
  });
}
