import client from './client';

export interface ContentPieceData {
  id: number;
  product_id: number;
  caption: string | null;
  tags_json: string | null;
  description: string | null;
  script_json: string | null;
  style: string;
  language: string;
  translations_json: string | null;
  created_at: string;
}

export async function listContent(productId?: number): Promise<ContentPieceData[]> {
  const res = await client.get<ContentPieceData[]>('/api/content/', {
    params: productId ? { product_id: productId } : {},
  });
  return res.data;
}

export async function getContent(id: number): Promise<ContentPieceData> {
  const res = await client.get<ContentPieceData>(`/api/content/${id}`);
  return res.data;
}

export async function generateContent(
  productId: number,
  style: string = 'product_review',
): Promise<ContentPieceData> {
  const res = await client.post<ContentPieceData>('/api/content/generate', {
    product_id: productId,
    style,
  });
  return res.data;
}

export async function generateScript(
  productId: number,
  style: string = 'product_review',
  duration: number = 30,
): Promise<ContentPieceData> {
  const res = await client.post<ContentPieceData>('/api/content/generate-script', {
    product_id: productId,
    style,
    duration,
  });
  return res.data;
}

export async function translateContent(
  contentId: number,
  languages: string[] = ['zh', 'es'],
): Promise<ContentPieceData> {
  const res = await client.post<ContentPieceData>(`/api/content/${contentId}/translate`, {
    languages,
  });
  return res.data;
}
