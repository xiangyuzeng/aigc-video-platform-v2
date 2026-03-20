import client from './client';

export interface Draft {
  id: number;
  name: string;
  data_json: string;
  created_at: string;
}

export async function getDrafts(): Promise<Draft[]> {
  const res = await client.get<Draft[]>('/api/drafts');
  return res.data;
}

export async function createDraft(name: string, data_json: string): Promise<Draft> {
  const res = await client.post<Draft>('/api/drafts', { name, data_json });
  return res.data;
}

export async function getDraft(id: number): Promise<Draft> {
  const res = await client.get<Draft>(`/api/drafts/${id}`);
  return res.data;
}

export async function deleteDraft(id: number): Promise<void> {
  await client.delete(`/api/drafts/${id}`);
}
