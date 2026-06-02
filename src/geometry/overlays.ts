/** Reference human height (cm) used by the scale-perception silhouette overlay. */
export const SILHOUETTE_HEIGHT_CM = 170

/**
 * Tick positions in cm along one wall axis, starting at 0 and ending at the
 * wall edge. Intermediate ticks land on multiples of `spacingCm`; the final
 * edge tick is always included, even if it falls between spacings.
 */
export function computeRulerTicks(
  wallLengthCm: number,
  spacingCm: number,
): number[] {
  const ticks: number[] = []
  for (let cm = 0; cm < wallLengthCm; cm += spacingCm) {
    ticks.push(cm)
  }
  if (ticks[ticks.length - 1] !== wallLengthCm) {
    ticks.push(wallLengthCm)
  }
  return ticks
}
