import type { BlobStore } from '../storage/blobStore'

/** Long edge in pixels at which imported photos are capped. */
export const LONG_EDGE_CAP_PX = 1500

export type ImportedPhoto = {
  id: string
  filename: string
  blobKey: string
  aspectRatio: number
}

export type DecodeImage = (file: Blob) => Promise<{ width: number; height: number }>
export type Downscale = (
  file: Blob,
  longEdgeCap: number,
) => Promise<{ blob: Blob; width: number; height: number }>

export type ImportPhotoFileDeps = {
  file: File
  blobStore: BlobStore
  createId: () => string
  decodeImage: DecodeImage
  downscale: Downscale
}

/**
 * Decode the image to learn its dimensions, downscale it to the long-edge cap,
 * persist the downscaled blob to `blobStore`, and return the metadata that
 * the reducer needs to add the photo to the tray.
 */
export async function importPhotoFile({
  file,
  blobStore,
  createId,
  decodeImage,
  downscale,
}: ImportPhotoFileDeps): Promise<ImportedPhoto> {
  await decodeImage(file)
  const out = await downscale(file, LONG_EDGE_CAP_PX)

  const id = createId()
  await blobStore.save(id, out.blob)

  return {
    id,
    filename: file.name,
    blobKey: id,
    aspectRatio: out.width / out.height,
  }
}
