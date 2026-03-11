export type VideoStatus = 'UPLOADING' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface Video {
  id: string;
  title: string;
  description: string | null;
  status: VideoStatus;
  uploadUrl?: string;
  thumbnailUrl: string | null;
  masterPlaylistUrl: string | null;
  fileSize: number | null;
  contentType: string | null;
  streams?: VideoStream[];
  createdAt: string;
  updatedAt?: string;
}

export interface VideoStream {
  id: string;
  resolution: string;
  playlistUrl: string;
}

export interface CreateVideoRequest {
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
