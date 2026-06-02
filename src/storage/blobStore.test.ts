import { describe, it, expect } from 'vitest'
import { createMemoryBlobStore } from './blobStore'

/** jsdom's Blob lacks .text() and Response body reading, so use FileReader. */
const blobText = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(b)
  })

describe('BlobStore (memory fake)', () => {
  it('returns null for an unknown key', async () => {
    const store = createMemoryBlobStore()
    expect(await store.load('missing')).toBeNull()
  })

  it('round-trips a stored blob', async () => {
    const store = createMemoryBlobStore()
    const blob = new Blob(['hello'], { type: 'text/plain' })

    await store.save('k1', blob)

    const loaded = await store.load('k1')
    expect(loaded).not.toBeNull()
    expect(await blobText(loaded!)).toBe('hello')
    expect(loaded!.type).toBe('text/plain')
  })

  it('keeps independent values per key', async () => {
    const store = createMemoryBlobStore()
    await store.save('a', new Blob(['A']))
    await store.save('b', new Blob(['B']))

    expect(await blobText((await store.load('a'))!)).toBe('A')
    expect(await blobText((await store.load('b'))!)).toBe('B')
  })

  it('deletes a stored blob', async () => {
    const store = createMemoryBlobStore()
    await store.save('k1', new Blob(['x']))

    await store.remove('k1')

    expect(await store.load('k1')).toBeNull()
  })
})
