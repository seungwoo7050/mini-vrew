import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createAppApi } from '@/data/createAppApi';
import { videoKey, videosKey } from '@/data/queryKeys';
import type { Video, VideoId } from '@/data/types';

export function useVideosQuery(): UseQueryResult<Video[], Error> {
  return useQuery<Video[], Error>({
    queryKey: videosKey,
    queryFn: () => createAppApi().listVideos(),
  });
}

export function useVideoQuery(
  id?: VideoId
): UseQueryResult<Video | null, Error> {
  return useQuery<Video | null, Error>({
    queryKey: id ? videoKey(id) : ['video', 'missing'],
    queryFn: () => createAppApi().getVideo(id!),
    enabled: Boolean(id),
  });
}
