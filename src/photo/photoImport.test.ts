import { describe, it, expect, vi } from 'vitest'
import { importPhotoFile } from './photoImport'
import { createMemoryBlobStore } from '../storage/blobStore'

describe('importPhotoFile', () => {
  it('stores the downscaled blob and returns metadata for the reducer', async () => {
    const blobStore = createMemoryBlobStore()
    const originalBlob = new Blob(['ORIGINAL'], { type: 'image/jpeg' })
    const downscaled = new Blob(['SMALL'], { type: 'image/jpeg' })

    const result = await importPhotoFile({
      file: new File([originalBlob], 'cat.jpg', { type: 'image/jpeg' }),
      blobStore,
      createId: () => 'photo-1',
      decodeImage: async () => ({ width: 3000, height: 2000 }),
      downscale: async () => ({ blob: downscaled, width: 1500, height: 1000 }),
    })

    expect(result).toEqual({
      id: 'photo-1',
      filename: 'cat.jpg',
      blobKey: 'photo-1',
      aspectRatio: 1500 / 1000,
    })

    const stored = await blobStore.load('photo-1')
    expect(stored).toBe(downscaled)
  })

  it('passes the long-edge cap of 1500 to the downscaler', async () => {
    const blobStore = createMemoryBlobStore()
    const downscale = vi.fn(async () => ({
      blob: new Blob(['x']),
      width: 1500,
      height: 1000,
    }))

    await importPhotoFile({
      file: new File(['data'], 'a.jpg', { type: 'image/jpeg' }),
      blobStore,
      createId: () => 'p1',
      decodeImage: async () => ({ width: 3000, height: 2000 }),
      downscale,
    })

    expect(downscale).toHaveBeenCalledWith(expect.any(File), 1500)
  })

  it('uses the decoded dimensions for aspect ratio when no downscale happens', async () => {
    const blobStore = createMemoryBlobStore()
    const small = new File(['data'], 'small.jpg', { type: 'image/jpeg' })

    const result = await importPhotoFile({
      file: small,
      blobStore,
      createId: () => 'p1',
      decodeImage: async () => ({ width: 800, height: 600 }),
      downscale: async (f) => ({ blob: f, width: 800, height: 600 }),
    })

    expect(result.aspectRatio).toBeCloseTo(800 / 600)
  })
})
