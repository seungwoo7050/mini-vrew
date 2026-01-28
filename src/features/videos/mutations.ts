import { useMutation, useQueryClient } from '@tanstack/react-query';

import { appApi } from '@/data/createAppApi';
import {
  captionsKey,
  thumbnailBlobKey,
  videoBlobKey,
  videoKey,
  videosKey,
} from '@/data/queryKeys';
import type { VideoId } from '@/data/types';

export function useDeleteVideoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: VideoId) => {
      await appApi.deleteVideo(id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: videosKey });
      queryClient.removeQueries({ queryKey: videoKey(id) });
      queryClient.removeQueries({ queryKey: videoBlobKey(id) });
      queryClient.removeQueries({ queryKey: thumbnailBlobKey(id) });
      queryClient.removeQueries({ queryKey: captionsKey(id) });
    },
  });
}
