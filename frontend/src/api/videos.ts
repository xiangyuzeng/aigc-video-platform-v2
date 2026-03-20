import client from './client';

export interface Video {
  id: number;
  title: string | null;
  file_path: string;
  cover_path: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  resolution: string | null;
  transcript: string | null;
  group_name: string | null;
  custom_pid: string | null;
  status: string;
  metadata_json: string | null;
  created_at: string;
}

export interface VideoListResponse {
  items: Video[];
  total: number;
}

export async function getVideos(params?: {
  group_name?: string;
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<VideoListResponse> {
  const res = await client.get<VideoListResponse>('/api/videos', { params });
  return res.data;
}

export async function getVideo(id: number): Promise<Video> {
  const res = await client.get<Video>(`/api/videos/${id}`);
  return res.data;
}

export async function uploadVideos(files: File[]): Promise<Video[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  const res = await client.post<Video[]>('/api/videos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300_000,
  });
  return res.data;
}

export async function deleteVideo(id: number): Promise<void> {
  await client.delete(`/api/videos/${id}`);
}

export function getVideoStreamUrl(id: number): string {
  return `/api/videos/${id}/stream`;
}

export function getVideoThumbnailUrl(id: number): string {
  return `/api/videos/${id}/thumbnail?t=${id}`;
}
