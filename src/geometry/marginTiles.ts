import { computeSizeFromLongEdge } from './sizing'

/** Gap (cm) below the wall before the first row of imports. */
export const MARGIN_TILE_TOP_GAP_CM = 10
/** Horizontal gap (cm) between tiles in the same row. */
export const MARGIN_TILE_GAP_CM = 8
/** Vertical gap (cm) between successive rows when the row wraps. */
export const MARGIN_TILE_ROW_GAP_CM = 8

export type MarginTileInput = {
  /** Long edge in cm assumed for layout (e.g. default placement size). */
  longEdgeCm: number
  /** Photos to lay out, in the order they should appear. */
  photos: { aspectRatio: number }[]
  /** The target wall's width in cm — controls when a row wraps. */
  wallWidthCm: number
  /** The target wall's height in cm — anchors the top of the first row. */
  wallHeightCm: number
}

export type MarginTilePosition = { xCm: number; yCm: number }

/**
 * Compute the {xCm, yCm} center positions of a batch of imported photos
 * tiled along the bottom margin of the wall, wrapping into additional rows
 * once a row would exceed the wall's width. Each row is centered on the
 * wall horizontally.
 *
 * The positions sit *outside* the wall (yCm > wallHeightCm) so the imports
 * land in the margin / "tray" area.
 */
export function computeMarginTilePositions({
  longEdgeCm,
  photos,
  wallWidthCm,
  wallHeightCm,
}: MarginTileInput): MarginTilePosition[] {
  if (photos.length === 0) return []
  const sizes = photos.map((p) => computeSizeFromLongEdge(longEdgeCm, p.aspectRatio))

  // Partition into rows whose summed width + gaps fits inside wallWidthCm.
  const rows: { indices: number[]; widthCm: number; heightCm: number }[] = []
  let rowIndices: number[] = []
  let rowWidthCm = 0
  let rowHeightCm = 0
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i]
    const tentative =
      rowIndices.length === 0 ? s.widthCm : rowWidthCm + MARGIN_TILE_GAP_CM + s.widthCm
    if (rowIndices.length > 0 && tentative > wallWidthCm) {
      rows.push({ indices: rowIndices, widthCm: rowWidthCm, heightCm: rowHeightCm })
      rowIndices = [i]
      rowWidthCm = s.widthCm
      rowHeightCm = s.heightCm
    } else {
      rowIndices.push(i)
      rowWidthCm = tentative
      rowHeightCm = Math.max(rowHeightCm, s.heightCm)
    }
  }
  if (rowIndices.length > 0) {
    rows.push({ indices: rowIndices, widthCm: rowWidthCm, heightCm: rowHeightCm })
  }

  const out: MarginTilePosition[] = new Array(photos.length)
  let rowTopCm = wallHeightCm + MARGIN_TILE_TOP_GAP_CM
  for (const row of rows) {
    let cursorXCm = (wallWidthCm - row.widthCm) / 2
    for (const idx of row.indices) {
      const s = sizes[idx]
      out[idx] = {
        xCm: cursorXCm + s.widthCm / 2,
        yCm: rowTopCm + row.heightCm / 2,
      }
      cursorXCm += s.widthCm + MARGIN_TILE_GAP_CM
    }
    rowTopCm += row.heightCm + MARGIN_TILE_ROW_GAP_CM
  }
  return out
}
