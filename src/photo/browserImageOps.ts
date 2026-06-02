import { computeDownscaleSize } from '../geometry/downscale'
import type { DecodeImage, Downscale } from './photoImport'

/** Read pixel dimensions of an image blob via createImageBitmap. */
export const decodeImage: DecodeImage = async (file) => {
  const bitmap = await createImageBitmap(file)
  const dims = { width: bitmap.width, height: bitmap.height }
  bitmap.close?.()
  return dims
}

/**
 * Downscale an image blob so its long edge is at most `longEdgeCap` pixels.
 * Returns the original blob unchanged when the image is already within the cap.
 * Output is JPEG at quality 0.9.
 */
export const downscale: Downscale = async (file, longEdgeCap) => {
  const bitmap = await createImageBitmap(file)
  const target = computeDownscaleSize({
    width: bitmap.width,
    height: bitmap.height,
    longEdgeCap,
  })

  if (target.width === bitmap.width && target.height === bitmap.height) {
    bitmap.close?.()
    return { blob: file, width: target.width, height: target.height }
  }

  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.drawImage(bitmap, 0, 0, target.width, target.height)
  bitmap.close?.()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      0.9,
    )
  })

  return { blob, width: target.width, height: target.height }
}
