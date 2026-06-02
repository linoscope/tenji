import { describe, it, expect } from 'vitest'
import { aggregatePrintRows } from './aggregate'
import type { Photo, Placement, Wall } from '../state/types'

const photo = (
  overrides: Partial<Photo> & { id: string; aspectRatio: number },
): Photo => ({
  id: overrides.id,
  filename: overrides.filename ?? `${overrides.id}.jpg`,
  blobKey: overrides.blobKey ?? `blob-${overrides.id}`,
  aspectRatio: overrides.aspectRatio,
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
  longEdgeCm: number,
): Placement => ({
  id,
  photoId,
  wallId,
  xCm: 0,
  yCm: 0,
  longEdgeCm,
})

describe('aggregatePrintRows', () => {
  it('groups placements by (photoId, longEdgeCm) with a count', () => {
    const photos = [photo({ id: 'p1', aspectRatio: 3 / 2 })]
    const walls = [wall('w1', 'North')]
    const placements = [
      placement('pl1', 'p1', 'w1', 42),
      placement('pl2', 'p1', 'w1', 42),
    ]

    const rows = aggregatePrintRows({ photos, placements, walls })

    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(2)
    expect(rows[0].photoId).toBe('p1')
    expect(rows[0].longEdgeCm).toBe(42)
  })

  it('separates rows when the same photo is placed at two different sizes', () => {
    const photos = [photo({ id: 'p1', aspectRatio: 3 / 2 })]
    const walls = [wall('w1', 'North')]
    const placements = [
      placement('pl1', 'p1', 'w1', 42),
      placement('pl2', 'p1', 'w1', 29.7),
    ]

    const rows = aggregatePrintRows({ photos, placements, walls })

    expect(rows).toHaveLength(2)
    const sizes = rows.map((r) => r.longEdgeCm).sort((a, b) => a - b)
    expect(sizes).toEqual([29.7, 42])
    expect(rows.every((r) => r.count === 1)).toBe(true)
  })

  it('exposes filename, sizeLabel, widthCm, heightCm, and orientation', () => {
    const photos = [
      photo({ id: 'p1', aspectRatio: 3 / 2, filename: 'sunset.jpg' }),
    ]
    const walls = [wall('w1', 'North')]
    const placements = [placement('pl1', 'p1', 'w1', 42)]

    const [row] = aggregatePrintRows({ photos, placements, walls })

    expect(row.filename).toBe('sunset.jpg')
    expect(row.sizeLabel).toBe('A3')
    expect(row.widthCm).toBeCloseTo(42)
    expect(row.heightCm).toBeCloseTo(28)
    expect(row.orientation).toBe('landscape')
    expect(row.blobKey).toBe('blob-p1')
  })

  it("labels a non-preset long edge as 'Custom'", () => {
    const photos = [photo({ id: 'p1', aspectRatio: 1 })]
    const walls = [wall('w1', 'North')]
    const placements = [placement('pl1', 'p1', 'w1', 50)]

    const [row] = aggregatePrintRows({ photos, placements, walls })

    expect(row.sizeLabel).toBe('Custom')
  })

  it('lists all wall names a row appears on, in wall order, without duplicates', () => {
    const photos = [photo({ id: 'p1', aspectRatio: 3 / 2 })]
    const walls = [wall('w1', 'North'), wall('w2', 'South'), wall('w3', 'East')]
    const placements = [
      placement('pl1', 'p1', 'w2', 42),
      placement('pl2', 'p1', 'w1', 42),
      placement('pl3', 'p1', 'w1', 42),
    ]

    const [row] = aggregatePrintRows({ photos, placements, walls })

    expect(row.wallNames).toEqual(['North', 'South'])
  })

  it('excludes photos that have no placements (tray-only)', () => {
    const photos = [
      photo({ id: 'p1', aspectRatio: 3 / 2 }),
      photo({ id: 'tray-only', aspectRatio: 1 }),
    ]
    const walls = [wall('w1', 'North')]
    const placements = [placement('pl1', 'p1', 'w1', 42)]

    const rows = aggregatePrintRows({ photos, placements, walls })

    expect(rows.map((r) => r.photoId)).toEqual(['p1'])
  })

  it('returns an empty array when no placements exist', () => {
    const photos = [photo({ id: 'p1', aspectRatio: 1 })]
    const walls = [wall('w1', 'North')]

    expect(aggregatePrintRows({ photos, placements: [], walls })).toEqual([])
  })

  it('ignores placements whose photo no longer exists', () => {
    const photos: Photo[] = []
    const walls = [wall('w1', 'North')]
    const placements = [placement('pl1', 'missing', 'w1', 42)]

    expect(aggregatePrintRows({ photos, placements, walls })).toEqual([])
  })
})
