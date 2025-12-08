import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createAppApi } from '@/data/createAppApi';
import {
  thumbnailBlobKey,
  videoBlobKey,
  videoKey,
  videosKey,
} from '@/data/queryKeys';
import type { CreateVideoInput } from '@/data/types';
import { createThumbnailPlaceholder } from './uploadService';

export type UploadPayload = {
  title: string;
  file: File;
};

type Created = {
  videoId: string;
  title: string;
};

async function createVideoWithAssets(payload: UploadPayload): Promise<Created> {
  const input: CreateVideoInput = {
    title: payload.title.trim() || payload.file.name,
  };

  const appApi = createAppApi();
  const video = await appApi.createVideo(input);
  await appApi.putVideoBlob(video.id, payload.file);
  const thumb = await createThumbnailPlaceholder(payload.file);
  await appApi.putThumbnailBlob(video.id, thumb);
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
