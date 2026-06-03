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
  size: { mode: 'aspect', longEdgeCm },
})

const cropPlacement = (
  id: string,
  photoId: string,
  wallId: string,
  widthCm: number,
  heightCm: number,
): Placement => ({
  id,
  photoId,
  wallId,
  xCm: 0,
  yCm: 0,
  size: { mode: 'crop', widthCm, heightCm },
})

describe('aggregatePrintRows', () => {
  it('groups placements by (photoId, resolved W x H) with a count', () => {
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
    expect(rows[0].widthCm).toBeCloseTo(42)
    expect(rows[0].heightCm).toBeCloseTo(28)
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
    const sizes = rows.map((r) => r.widthCm).sort((a, b) => a - b)
    expect(sizes[0]).toBeCloseTo(29.7)
    expect(sizes[1]).toBeCloseTo(42)
    expect(rows.every((r) => r.count === 1)).toBe(true)
  })

  it('groups aspect and crop placements that resolve to the same W x H', () => {
    // A 42x28 aspect placement (3:2 photo, A3) groups with an identical crop.
    const photos = [photo({ id: 'p1', aspectRatio: 3 / 2 })]
    const walls = [wall('w1', 'North')]
    const placements = [
      placement('pl1', 'p1', 'w1', 42),
      cropPlacement('pl2', 'p1', 'w1', 42, 28),
    ]

    const rows = aggregatePrintRows({ photos, placements, walls })

    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(2)
  })

  it('separates aspect and crop placements that resolve to different W x H', () => {
    const photos = [photo({ id: 'p1', aspectRatio: 3 / 2 })]
    const walls = [wall('w1', 'North')]
    const placements = [
      placement('pl1', 'p1', 'w1', 42), // 42x28
      cropPlacement('pl2', 'p1', 'w1', 42, 29.7), // different shape
    ]

    const rows = aggregatePrintRows({ photos, placements, walls })

    expect(rows).toHaveLength(2)
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

  it('excludes placements whose center is outside the wall bounds (margin-parked)', () => {
    const photos = [photo({ id: 'p1', aspectRatio: 1 })]
    const walls = [wall('w1', 'North')] // 500 x 300
    const onWall: Placement = {
      id: 'pl-on',
      photoId: 'p1',
      wallId: 'w1',
      xCm: 250,
      yCm: 150,
      size: { mode: 'aspect' as const, longEdgeCm: 42 },
    }
    const inMargin: Placement = {
      id: 'pl-margin',
      photoId: 'p1',
      wallId: 'w1',
      xCm: 250,
      yCm: 400, // below the wall
      size: { mode: 'aspect', longEdgeCm: 42 },
    }
    const offLeft: Placement = {
      id: 'pl-off-left',
      photoId: 'p1',
      wallId: 'w1',
      xCm: -10,
      yCm: 150,
      size: { mode: 'aspect' as const, longEdgeCm: 42 },
    }

    const rows = aggregatePrintRows({
      photos,
      placements: [onWall, inMargin, offLeft],
      walls,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(1)
  })

  it('excludes placements whose wall no longer exists', () => {
    const photos = [photo({ id: 'p1', aspectRatio: 1 })]
    const walls = [wall('w1', 'North')]
    const placements = [placement('pl1', 'p1', 'ghost-wall', 42)]

    expect(aggregatePrintRows({ photos, placements, walls })).toEqual([])
  })
})
