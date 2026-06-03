import type { PlacementSize } from '../state/types'

export type Orientation = 'portrait' | 'landscape' | 'square'

export type PhotoSize = {
  widthCm: number
  heightCm: number
  orientation: Orientation
}

/**
 * Resolve a placement's on-wall rectangle from its sizing mode plus the
 * source photo's aspect ratio.
 *
 * - Aspect: long edge along the photo's longer dimension, other follows.
 * - Crop: pass-through W×H; orientation follows whichever side is longer.
 */
export function resolvePlacementSize(
  size: PlacementSize,
  aspectRatio: number,
): PhotoSize {
  if (size.mode === 'aspect') {
    return computeSizeFromLongEdge(size.longEdgeCm, aspectRatio)
  }
  const { widthCm, heightCm } = size
  const orientation: Orientation =
    widthCm > heightCm ? 'landscape' : widthCm < heightCm ? 'portrait' : 'square'
  return { widthCm, heightCm, orientation }
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

/**
 * A bulk-resize choice — either a paper preset (e.g. A3) or a custom long edge
 * in cm. Used by both the single-placement inspector and the multi-selection
 * bulk-resize UI.
 */
export type SizeChoice =
  | { kind: 'preset'; longEdgeCm: number }
  | { kind: 'custom'; longEdgeCm: number }

/**
 * Apply a size choice to a placement's current size *without changing its
 * mode*. Aspect placements always get their long edge set to the chosen value.
 * Crop placements interpret a preset as the photo-oriented paper rectangle for
 * that preset, and a custom long edge as "scale the current crop rectangle so
 * its long edge equals the value, preserving the W:H ratio."
 */
export function applySizeChoice(
  current: PlacementSize,
  aspectRatio: number,
  choice: SizeChoice,
): PlacementSize {
  if (current.mode === 'aspect') {
    return { mode: 'aspect', longEdgeCm: choice.longEdgeCm }
  }
  if (choice.kind === 'preset') {
    const rect = computeSizeFromLongEdge(choice.longEdgeCm, aspectRatio)
    return { mode: 'crop', widthCm: rect.widthCm, heightCm: rect.heightCm }
  }
  const longEdge = Math.max(current.widthCm, current.heightCm)
  const scale = choice.longEdgeCm / longEdge
  return {
    mode: 'crop',
    widthCm: current.widthCm * scale,
    heightCm: current.heightCm * scale,
  }
}
