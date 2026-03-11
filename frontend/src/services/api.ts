import axios from 'axios';
import type { ApiResponse, CreateVideoRequest, PagedResponse, Video } from '../types/video';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

export async function createVideo(request: CreateVideoRequest): Promise<Video> {
  const { data } = await api.post<ApiResponse<Video>>('/videos', request);
  if (data.error) throw new Error(data.error);
  return data.data!;
}

export async function completeUpload(videoId: string): Promise<Video> {
  const { data } = await api.post<ApiResponse<Video>>(`/videos/${encodeURIComponent(videoId)}/complete`);
  if (data.error) throw new Error(data.error);
  return data.data!;
}

export async function uploadFileToR2(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
}

export async function listVideos(page = 0, size = 20): Promise<PagedResponse<Video>> {
  const { data } = await api.get<ApiResponse<PagedResponse<Video>>>('/videos', {
    params: { page, size },
  });
  if (data.error) throw new Error(data.error);
  return data.data!;
}

export async function getVideo(videoId: string): Promise<Video> {
  const { data } = await api.get<ApiResponse<Video>>(`/videos/${encodeURIComponent(videoId)}`);
  if (data.error) throw new Error(data.error);
  return data.data!;
}

export async function retryVideo(videoId: string): Promise<Video> {
  const { data } = await api.post<ApiResponse<Video>>(`/videos/${encodeURIComponent(videoId)}/retry`);
  if (data.error) throw new Error(data.error);
  return data.data!;
}
