/** Persistence boundary for image blobs, keyed by id. */
export interface BlobStore {
  load(key: string): Promise<Blob | null>
  save(key: string, blob: Blob): Promise<void>
  remove(key: string): Promise<void>
}

/** In-memory fake for tests. */
export function createMemoryBlobStore(): BlobStore {
  const map = new Map<string, Blob>()
  return {
    async load(key) {
      return map.get(key) ?? null
    },
    async save(key, blob) {
      map.set(key, blob)
    },
    async remove(key) {
      map.delete(key)
    },
  }
}
