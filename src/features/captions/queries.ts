import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { appApi } from '@/data/createAppApi';
import { captionsKey } from '@/data/queryKeys';
import type { Caption, VideoId } from '@/data/types';
import { sortCaptions } from './format';

export function useCaptionsQuery(videoId: VideoId) {
  return useQuery<Caption[], Error>({
    queryKey: captionsKey(videoId),
    queryFn: async () => appApi.listCaptions(videoId).then(sortCaptions),
    enabled: Boolean(videoId),
  });
}

export function useSaveCaptionsMutation(videoId: VideoId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (captions: Caption[]) =>
      appApi.saveCaptions(videoId, sortCaptions(captions)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: captionsKey(videoId) });
    },
  });
}
