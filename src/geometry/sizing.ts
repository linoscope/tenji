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

export type SizePreset = { label: string; longEdgeCm: number }

/** A-series paper presets, ordered from smallest to largest by long edge. */
export const A_SERIES_PRESETS: readonly SizePreset[] = [
  { label: 'A5', longEdgeCm: 21 },
  { label: 'A4', longEdgeCm: 29.7 },
  { label: 'A3', longEdgeCm: 42 },
  { label: 'A2', longEdgeCm: 59.4 },
  { label: 'A1', longEdgeCm: 84.1 },
  { label: 'A0', longEdgeCm: 118.9 },
]

const PRESET_MATCH_EPSILON_CM = 0.05

/** Returns the preset label that matches longEdgeCm, or 'Custom' otherwise. */
export function resolveSizeLabel(longEdgeCm: number): string {
  const match = A_SERIES_PRESETS.find(
    (p) => Math.abs(p.longEdgeCm - longEdgeCm) < PRESET_MATCH_EPSILON_CM,
  )
  return match ? match.label : 'Custom'
}
