import {
  useQuery,
  type UseQueryResult,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { createAppApi } from '@/data/createAppApi';
import { videoBlobKey, videoKey, videosKey } from '@/data/queryKeys';
import type { Video, VideoId } from '@/data/types';

export function useVideosQuery(
  options?: Omit<UseQueryOptions<Video[], Error>, 'queryKey' | 'queryFn'>
): UseQueryResult<Video[], Error> {
  return useQuery<Video[], Error>({
    queryKey: videosKey,
    queryFn: () => createAppApi().listVideos(),
    refetchOnMount: 'always',
    ...options,
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

export function useVideoBlobQuery(
  id?: VideoId
): UseQueryResult<Blob | null, Error> {
  return useQuery<Blob | null, Error>({
    queryKey: id ? videoBlobKey(id) : ['video', 'blob', 'missing'],
    queryFn: async () => {
      if (!id) return null;
      return createAppApi().getVideoBlob(id);
    },
    enabled: Boolean(id),
  });
}
