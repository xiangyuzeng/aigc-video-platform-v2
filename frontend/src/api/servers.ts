import client from './client';

export interface Server {
  id: number;
  name: string;
  base_url: string;
  is_default: boolean;
  last_connected_at: string | null;
  created_at: string;
}

export interface ServerCreate {
  name: string;
  base_url: string;
}

export interface ServerUpdate {
  name?: string;
  base_url?: string;
  is_default?: boolean;
}

export async function getServers(): Promise<Server[]> {
  const res = await client.get<Server[]>('/api/servers');
  return res.data;
}

export async function createServer(data: ServerCreate): Promise<Server> {
  const res = await client.post<Server>('/api/servers', data);
  return res.data;
}

export async function updateServer(id: number, data: ServerUpdate): Promise<Server> {
  const res = await client.put<Server>(`/api/servers/${id}`, data);
  return res.data;
}

export async function deleteServer(id: number): Promise<void> {
  await client.delete(`/api/servers/${id}`);
}
