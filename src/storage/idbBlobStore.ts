import { createStore, get, set, del } from 'idb-keyval'
import type { BlobStore } from './blobStore'

const blobStore = createStore('tenji:blobs', 'blobs')

/** IndexedDB-backed blob storage (production). */
export function createIdbBlobStore(): BlobStore {
  return {
    async load(key) {
      return (await get<Blob>(key, blobStore)) ?? null
    },
    async save(key, blob) {
      await set(key, blob, blobStore)
    },
    async remove(key) {
      await del(key, blobStore)
    },
  }
}
