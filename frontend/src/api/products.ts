import client from './client';

export interface ProductData {
  id: number;
  name: string;
  category: string | null;
  price: number | null;
  currency: string;
  source_url: string | null;
  image_urls_json: string | null;
  description: string | null;
  score: number | null;
  score_reasoning: string | null;
  suggested_angles_json: string | null;
  raw_data_json: string | null;
  created_at: string;
}

export interface ProductListResponse {
  items: ProductData[];
  total: number;
}

export async function listProducts(params?: {
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<ProductListResponse> {
  const res = await client.get<ProductListResponse>('/api/products/', { params });
  return res.data;
}

export async function getProduct(id: number): Promise<ProductData> {
  const res = await client.get<ProductData>(`/api/products/${id}`);
  return res.data;
}

export async function createProduct(data: {
  name: string;
  category?: string;
  price?: number;
  currency?: string;
  source_url?: string;
  description?: string;
}): Promise<ProductData> {
  const res = await client.post<ProductData>('/api/products/', data);
  return res.data;
}

export async function deleteProduct(id: number): Promise<void> {
  await client.delete(`/api/products/${id}`);
}

export async function scrapeProduct(url: string): Promise<ProductData> {
  const res = await client.post<ProductData>('/api/products/scrape', { url });
  return res.data;
}

export async function scoreProduct(id: number): Promise<ProductData> {
  const res = await client.post<ProductData>(`/api/products/${id}/score`);
  return res.data;
}
