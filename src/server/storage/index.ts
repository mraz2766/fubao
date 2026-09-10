import { env } from 'cloudflare:workers';
export interface StorageAdapter {
  put(key: string, data: ArrayBuffer | Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<R2ObjectBody | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
export const storage: StorageAdapter = {
  async put(key, data, contentType) {
    await env.PHOTOS.put(key, data, {
      httpMetadata: { contentType, cacheControl: 'private, no-store' },
    });
  },
  get: (key) => env.PHOTOS.get(key),
  async exists(key) {
    return !!(await env.PHOTOS.head(key));
  },
  async delete(key) {
    await env.PHOTOS.delete(key);
  },
};
