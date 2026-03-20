import client from './client';

export interface PipelineRunData {
  id: number;
  product_id: number | null;
  video_id: number | null;
  content_piece_id: number | null;
  style: string;
  video_source: string;
  uploaded_video_path: string | null;
  target_profile_ids_json: string | null;
  schedule_time: string | null;
  timezone: string;
  status: string;
  current_stage: string;
  stages_json: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface PipelineRunListResponse {
  items: PipelineRunData[];
  total: number;
}

export async function listPipelineRuns(params?: {
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<PipelineRunListResponse> {
  const res = await client.get<PipelineRunListResponse>('/api/pipeline/runs', { params });
  return res.data;
}

export async function getPipelineRun(id: number): Promise<PipelineRunData> {
  const res = await client.get<PipelineRunData>(`/api/pipeline/runs/${id}`);
  return res.data;
}

export async function startPipeline(data: {
  product_id: number;
  style?: string;
  video_source?: string;
  uploaded_video_path?: string;
  target_profile_ids?: number[];
  schedule_time?: string;
  timezone?: string;
}): Promise<PipelineRunData> {
  const res = await client.post<PipelineRunData>('/api/pipeline/run', data);
  return res.data;
}

export async function resumePipelineRun(id: number): Promise<PipelineRunData> {
  const res = await client.post<PipelineRunData>(`/api/pipeline/runs/${id}/resume`);
  return res.data;
}

export async function cancelPipelineRun(id: number): Promise<{ ok: boolean }> {
  const res = await client.post<{ ok: boolean }>(`/api/pipeline/runs/${id}/cancel`);
  return res.data;
}

export async function deletePipelineRun(id: number): Promise<void> {
  await client.delete(`/api/pipeline/runs/${id}`);
}
