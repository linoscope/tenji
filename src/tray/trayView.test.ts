import { describe, it, expect } from 'vitest'
import { computeTrayItems } from './trayView'
import type { Photo, Placement, Wall } from '../state/types'

const photo = (
  overrides: Partial<Photo> & { id: string; aspectRatio?: number },
): Photo => ({
  id: overrides.id,
  filename: overrides.filename ?? `${overrides.id}.jpg`,
  blobKey: overrides.blobKey ?? `blob-${overrides.id}`,
  aspectRatio: overrides.aspectRatio ?? 3 / 2,
})

const wall = (id: string, name: string): Wall => ({
  id,
  name,
  widthCm: 500,
  heightCm: 300,
})

const placement = (
  id: string,
  photoId: string,
  wallId: string,
): Placement => ({
  id,
  photoId,
  wallId,
  xCm: 0,
  yCm: 0,
  longEdgeCm: 42,
})

describe('computeTrayItems', () => {
  it('returns every photo with placed=false when no placements exist', () => {
    const photos = [photo({ id: 'p1' }), photo({ id: 'p2' })]
    const items = computeTrayItems({ photos, placements: [], walls: [] })

    expect(items).toHaveLength(2)
    expect(items.map((i) => i.photo.id)).toEqual(['p1', 'p2'])
    expect(items.every((i) => i.placed === false)).toBe(true)
    expect(items.every((i) => i.wallNames.length === 0)).toBe(true)
  })

  it('marks a photo placed when it has at least one placement on any wall', () => {
    const photos = [photo({ id: 'p1' }), photo({ id: 'p2' })]
    const walls = [wall('w1', 'North')]
    const placements = [placement('pl1', 'p1', 'w1')]

    const items = computeTrayItems({ photos, placements, walls })
    const byId = new Map(items.map((i) => [i.photo.id, i]))

    expect(byId.get('p1')?.placed).toBe(true)
    expect(byId.get('p2')?.placed).toBe(false)
  })

  it('sorts unplaced first (in photo order), then placed (in photo order)', () => {
    const photos = [
      photo({ id: 'p1' }),
      photo({ id: 'p2' }),
      photo({ id: 'p3' }),
      photo({ id: 'p4' }),
    ]
    const walls = [wall('w1', 'North')]
    const placements = [
      placement('pl1', 'p1', 'w1'),
      placement('pl2', 'p3', 'w1'),
    ]

    const items = computeTrayItems({ photos, placements, walls })

    // p2, p4 unplaced (in original photo order), then p1, p3 placed (in original photo order).
    expect(items.map((i) => i.photo.id)).toEqual(['p2', 'p4', 'p1', 'p3'])
  })

  it('lists wall names in wall order and deduplicates duplicates', () => {
    const photos = [photo({ id: 'p1' })]
    const walls = [wall('w1', 'North'), wall('w2', 'South'), wall('w3', 'East')]
    const placements = [
      placement('pl1', 'p1', 'w2'),
      placement('pl2', 'p1', 'w1'),
      placement('pl3', 'p1', 'w1'),
    ]

    const [item] = computeTrayItems({ photos, placements, walls })

    expect(item.wallNames).toEqual(['North', 'South'])
  })

  it('reports a single wall name when the photo is on exactly one wall', () => {
    const photos = [photo({ id: 'p1' })]
    const walls = [wall('w1', 'North')]
    const placements = [
      placement('pl1', 'p1', 'w1'),
      placement('pl2', 'p1', 'w1'),
    ]

    const [item] = computeTrayItems({ photos, placements, walls })

    expect(item.wallNames).toEqual(['North'])
  })

  it('ignores placements that reference a missing photo', () => {
    const photos = [photo({ id: 'p1' })]
    const walls = [wall('w1', 'North')]
    const placements = [
      placement('pl1', 'missing', 'w1'),
      placement('pl2', 'p1', 'w1'),
    ]

    const items = computeTrayItems({ photos, placements, walls })

    expect(items).toHaveLength(1)
    expect(items[0].photo.id).toBe('p1')
    expect(items[0].placed).toBe(true)
    expect(items[0].wallNames).toEqual(['North'])
  })

  it('ignores placements that reference a missing wall', () => {
    const photos = [photo({ id: 'p1' })]
    const walls = [wall('w1', 'North')]
    const placements = [
      placement('pl1', 'p1', 'ghost-wall'),
    ]

    const [item] = computeTrayItems({ photos, placements, walls })

    // A placement on a missing wall is treated as no placement at all.
    expect(item.placed).toBe(false)
    expect(item.wallNames).toEqual([])
  })
})
