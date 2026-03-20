import client from './client';

export interface TemplateData {
  id: number;
  name: string;
  content_template: string | null;
  tags_template: string | null;
  variables: string[];
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreate {
  name: string;
  content_template?: string;
  tags_template?: string;
  category?: string;
}

export async function getTemplates(category?: string): Promise<TemplateData[]> {
  const params = category ? { category } : {};
  const res = await client.get<TemplateData[]>('/api/templates/', { params });
  return res.data;
}

export async function getCategories(): Promise<string[]> {
  const res = await client.get<string[]>('/api/templates/categories');
  return res.data;
}

export async function createTemplate(data: TemplateCreate): Promise<TemplateData> {
  const res = await client.post<TemplateData>('/api/templates/', data);
  return res.data;
}

export async function updateTemplate(id: number, data: Partial<TemplateCreate>): Promise<TemplateData> {
  const res = await client.put<TemplateData>(`/api/templates/${id}`, data);
  return res.data;
}

export async function deleteTemplate(id: number): Promise<void> {
  await client.delete(`/api/templates/${id}`);
}

export async function applyTemplate(id: number, variables: Record<string, string>): Promise<{ content: string | null; tags: string | null }> {
  const res = await client.post<{ content: string | null; tags: string | null }>(`/api/templates/${id}/apply`, { variables });
  return res.data;
}
