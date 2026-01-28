import { useQuery } from '@tanstack/react-query';

import { appApi } from '@/data/createAppApi';
import { thumbnailBlobKey } from '@/data/queryKeys';
import type { VideoId } from '@/data/types';

export function useThumbnailBlobQuery(id?: VideoId) {
  return useQuery({
    queryKey: id ? thumbnailBlobKey(id) : ['thumbnail-blob', 'missing'],
    queryFn: async () => {
      if (!id) return null;
      return appApi.getThumbnailBlob(id);
    },
    enabled: Boolean(id),
    refetchOnMount: 'always',
    staleTime: 5 * 60 * 1000,
  });
}
