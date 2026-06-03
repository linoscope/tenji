import { describe, it, expect } from 'vitest'
import {
  buildClipboardEntries,
  computePastePositions,
  type ClipboardEntry,
} from './pasteTransform'

describe('buildClipboardEntries', () => {
  it('captures photoId, longEdgeCm, and per-placement offsets relative to the cluster centroid', () => {
    const entries = buildClipboardEntries([
      { id: 'pl-1', photoId: 'ph-a', wallId: 'w1', xCm: 100, yCm: 100, size: { mode: 'aspect' as const, longEdgeCm: 30 } },
      { id: 'pl-2', photoId: 'ph-b', wallId: 'w1', xCm: 200, yCm: 100, size: { mode: 'aspect' as const, longEdgeCm: 40 } },
    ])
    // Centroid of (100,100) and (200,100) is (150,100).
    expect(entries).toEqual([
      { photoId: 'ph-a', size: { mode: 'aspect', longEdgeCm: 30 }, dxCm: -50, dyCm: 0 },
      { photoId: 'ph-b', size: { mode: 'aspect', longEdgeCm: 40 }, dxCm: 50, dyCm: 0 },
    ])
  })

  it('returns an empty array for an empty input', () => {
    expect(buildClipboardEntries([])).toEqual([])
  })

  it('preserves input order even when sources are listed unsorted', () => {
    const entries = buildClipboardEntries([
      { id: 'pl-z', photoId: 'pz', wallId: 'w1', xCm: 300, yCm: 80, size: { mode: 'aspect' as const, longEdgeCm: 20 } },
      { id: 'pl-a', photoId: 'pa', wallId: 'w1', xCm: 100, yCm: 40, size: { mode: 'aspect' as const, longEdgeCm: 20 } },
    ])
    expect(entries.map((e) => e.photoId)).toEqual(['pz', 'pa'])
  })
})

describe('computePastePositions', () => {
  const wall = { widthCm: 500, heightCm: 300 }
  const entries: ClipboardEntry[] = [
    { photoId: 'ph-a', size: { mode: 'aspect', longEdgeCm: 30 }, dxCm: -50, dyCm: 0 },
    { photoId: 'ph-b', size: { mode: 'aspect', longEdgeCm: 40 }, dxCm: 50, dyCm: 0 },
  ]

  it('cross-wall paste anchors on the originals (sourceCenter), preserving arrangement', () => {
    const out = computePastePositions({
      entries,
      sourceCenter: { xCm: 150, yCm: 100 },
      sameWall: false,
      wall,
    })
    // Same coordinates as the originals (sourceCenter (150,100) + offsets).
    expect(out).toEqual([
      { xCm: 100, yCm: 100, size: { mode: 'aspect', longEdgeCm: 30 } },
      { xCm: 200, yCm: 100, size: { mode: 'aspect', longEdgeCm: 40 } },
    ])
  })

  it('same-wall paste offsets by a small nudge so copies do not sit on top of the originals', () => {
    const out = computePastePositions({
      entries,
      sourceCenter: { xCm: 150, yCm: 100 },
      sameWall: true,
      wall,
    })
    // Both copies shift by the same offset (relative arrangement preserved).
    const dx1 = out[0].xCm - 100
    const dy1 = out[0].yCm - 100
    expect(dx1).toBeGreaterThan(0)
    expect(dy1).toBeGreaterThan(0)
    expect(out[1].xCm - 200).toBeCloseTo(dx1)
    expect(out[1].yCm - 100).toBeCloseTo(dy1)
  })

  it('clamps centers into the target wall bounds when the original cluster sits outside', () => {
    // Anchor far off the right edge; widest tile is 40cm so center.x must be ≤ 480.
    const out = computePastePositions({
      entries,
      sourceCenter: { xCm: 9999, yCm: 9999 },
      sameWall: false,
      wall,
    })
    // Each x is clamped to within the wall.
    for (const r of out) {
      expect(r.xCm).toBeGreaterThanOrEqual(0)
      expect(r.xCm).toBeLessThanOrEqual(wall.widthCm)
      expect(r.yCm).toBeGreaterThanOrEqual(0)
      expect(r.yCm).toBeLessThanOrEqual(wall.heightCm)
    }
  })

  it('preserves the cluster shape after clamping (delta between siblings unchanged)', () => {
    const out = computePastePositions({
      entries,
      sourceCenter: { xCm: 9999, yCm: 9999 },
      sameWall: false,
      wall,
    })
    expect(out[1].xCm - out[0].xCm).toBeCloseTo(100)
    expect(out[1].yCm - out[0].yCm).toBeCloseTo(0)
  })

  it('respects square-aspect assumed bounds (centers stay inside the wall)', () => {
    // Single entry, anchor in-bounds, should not move.
    const single: ClipboardEntry[] = [
      { photoId: 'p', size: { mode: 'aspect', longEdgeCm: 20 }, dxCm: 0, dyCm: 0 },
    ]
    const out = computePastePositions({
      entries: single,
      sourceCenter: { xCm: 250, yCm: 150 },
      sameWall: false,
      wall,
    })
    expect(out).toEqual([{ xCm: 250, yCm: 150, size: { mode: 'aspect', longEdgeCm: 20 } }])
  })

  it('returns an empty array when entries is empty', () => {
    expect(
      computePastePositions({
        entries: [],
        sourceCenter: { xCm: 0, yCm: 0 },
        sameWall: false,
        wall,
      }),
    ).toEqual([])
  })
})
