export type FitScaleInput = {
  wallWidthCm: number
  wallHeightCm: number
  viewportWidthPx: number
  viewportHeightPx: number
  /** Empty space reserved on every side of the wall, in pixels. */
  marginPx: number
}

/**
 * Pixels-per-cm that fits the whole wall inside the viewport (minus margin on
 * all sides), constrained by whichever dimension is tighter. Always > 0.
 */
export function computeFitScale({
  wallWidthCm,
  wallHeightCm,
  viewportWidthPx,
  viewportHeightPx,
  marginPx,
}: FitScaleInput): number {
  const availableWidth = Math.max(0, viewportWidthPx - 2 * marginPx)
  const availableHeight = Math.max(0, viewportHeightPx - 2 * marginPx)
  return Math.min(availableWidth / wallWidthCm, availableHeight / wallHeightCm)
}

export function cmToPx(cm: number, scale: number): number {
  return cm * scale
}
