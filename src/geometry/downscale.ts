export type DownscaleSizeInput = {
  width: number
  height: number
  longEdgeCap: number
}

export type Size = { width: number; height: number }

/**
 * Target pixel dimensions when capping the long edge at `longEdgeCap`.
 * Preserves aspect ratio. Never upscales — images already at or below the cap
 * keep their original size.
 */
export function computeDownscaleSize({
  width,
  height,
  longEdgeCap,
}: DownscaleSizeInput): Size {
  const longEdge = Math.max(width, height)
  if (longEdge <= longEdgeCap) {
    return { width, height }
  }
  const scale = longEdgeCap / longEdge
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}
