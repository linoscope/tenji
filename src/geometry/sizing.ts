export type Orientation = 'portrait' | 'landscape' | 'square'

export type PhotoSize = {
  widthCm: number
  heightCm: number
  orientation: Orientation
}

/**
 * Resolve a printed photo's real-world width and height in cm from its long
 * edge size and source aspect ratio (width / height of the pixel image).
 */
export function computeSizeFromLongEdge(
  longEdgeCm: number,
  aspectRatio: number,
): PhotoSize {
  if (aspectRatio > 1) {
    return {
      widthCm: longEdgeCm,
      heightCm: longEdgeCm / aspectRatio,
      orientation: 'landscape',
    }
  }
  if (aspectRatio < 1) {
    return {
      widthCm: longEdgeCm * aspectRatio,
      heightCm: longEdgeCm,
      orientation: 'portrait',
    }
  }
  return { widthCm: longEdgeCm, heightCm: longEdgeCm, orientation: 'square' }
}
