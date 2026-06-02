import { describe, it, expect } from 'vitest'
import {
  computeMarginTilePositions,
  MARGIN_TILE_GAP_CM,
  MARGIN_TILE_ROW_GAP_CM,
  MARGIN_TILE_TOP_GAP_CM,
} from './marginTiles'

describe('computeMarginTilePositions', () => {
  it('returns an empty array when there are no photos', () => {
    expect(
      computeMarginTilePositions({
        longEdgeCm: 42,
        photos: [],
        wallWidthCm: 500,
        wallHeightCm: 300,
      }),
    ).toEqual([])
  })

  it('places one photo centered below the wall, in the margin', () => {
    const positions = computeMarginTilePositions({
      longEdgeCm: 42,
      photos: [{ aspectRatio: 1 }], // 42 x 42 cm
      wallWidthCm: 500,
      wallHeightCm: 300,
    })
    expect(positions).toHaveLength(1)
    // Centered horizontally on a 500-wide wall.
    expect(positions[0].xCm).toBeCloseTo(250)
    // Top of the row sits MARGIN_TILE_TOP_GAP_CM below the wall; center
    // is half the tile height below that top edge.
    expect(positions[0].yCm).toBeCloseTo(300 + MARGIN_TILE_TOP_GAP_CM + 21)
    // Outside the wall on the bottom.
    expect(positions[0].yCm).toBeGreaterThan(300)
  })

  it('tiles a row with no overlap and a gap between tiles', () => {
    // Three landscape 3:2 photos at long-edge 42 → each 42x28; 3 tiles +
    // 2 gaps = 42*3 + GAP*2 = 126 + 2*GAP. Fits in a 500 wall easily.
    const positions = computeMarginTilePositions({
      longEdgeCm: 42,
      photos: [
        { aspectRatio: 3 / 2 },
        { aspectRatio: 3 / 2 },
        { aspectRatio: 3 / 2 },
      ],
      wallWidthCm: 500,
      wallHeightCm: 300,
    })
    expect(positions).toHaveLength(3)
    // All in one row → same yCm.
    expect(positions[0].yCm).toEqual(positions[1].yCm)
    expect(positions[1].yCm).toEqual(positions[2].yCm)
    // Successive centers are exactly tile-width + gap apart.
    const expectedDx = 42 + MARGIN_TILE_GAP_CM
    expect(positions[1].xCm - positions[0].xCm).toBeCloseTo(expectedDx)
    expect(positions[2].xCm - positions[1].xCm).toBeCloseTo(expectedDx)
  })

  it('wraps onto a new row when the next tile would exceed wall width', () => {
    // Wall is 100 cm wide; tiles are 42 cm wide; two fit in a row with the
    // gap (42 + GAP + 42 = 84 + GAP ≤ 100 if GAP ≤ 16); a third forces a wrap.
    const positions = computeMarginTilePositions({
      longEdgeCm: 42,
      photos: [
        { aspectRatio: 1 },
        { aspectRatio: 1 },
        { aspectRatio: 1 },
      ],
      wallWidthCm: 100,
      wallHeightCm: 300,
    })
    expect(positions).toHaveLength(3)
    expect(positions[0].yCm).toEqual(positions[1].yCm)
    // The wrapped tile sits a tile-height + ROW_GAP below the first row.
    expect(positions[2].yCm).toBeCloseTo(
      positions[0].yCm + 42 + MARGIN_TILE_ROW_GAP_CM,
    )
  })

  it('positions every tile center outside the wall (yCm > wallHeightCm)', () => {
    const positions = computeMarginTilePositions({
      longEdgeCm: 42,
      photos: [
        { aspectRatio: 1 },
        { aspectRatio: 1 },
        { aspectRatio: 1 },
      ],
      wallWidthCm: 100,
      wallHeightCm: 300,
    })
    for (const p of positions) {
      expect(p.yCm).toBeGreaterThan(300)
    }
  })

  it('respects the order of the input photos', () => {
    const positions = computeMarginTilePositions({
      longEdgeCm: 42,
      photos: [
        { aspectRatio: 3 / 2 }, // 42 x 28
        { aspectRatio: 1 }, // 42 x 42
        { aspectRatio: 2 / 3 }, // 28 x 42
      ],
      wallWidthCm: 500,
      wallHeightCm: 300,
    })
    expect(positions[0].xCm).toBeLessThan(positions[1].xCm)
    expect(positions[1].xCm).toBeLessThan(positions[2].xCm)
  })
})
