import type { Photo, Placement, Wall } from '../state/types'
import {
  computeSizeFromLongEdge,
  resolveSizeLabel,
  type Orientation,
} from '../geometry/sizing'

export type PrintRow = {
  photoId: string
  filename: string
  blobKey: string
  longEdgeCm: number
  sizeLabel: string
  widthCm: number
  heightCm: number
  orientation: Orientation
  count: number
  /** Wall names this row appears on, ordered by wall order, deduplicated. */
  wallNames: string[]
}

type AggregateInput = {
  photos: Photo[]
  placements: Placement[]
  walls: Wall[]
}

/**
 * Group placements across all walls by (photoId, longEdgeCm). Only
 * placements whose **center is inside the wall bounds** count — margin-
 * parked placements are excluded. Placements pointing at a missing photo
 * or wall are also excluded.
 */
export function aggregatePrintRows({
  photos,
  placements,
  walls,
}: AggregateInput): PrintRow[] {
  const photoById = new Map(photos.map((p) => [p.id, p]))
  const wallNameById = new Map(walls.map((w) => [w.id, w.name]))
  const wallOrder = new Map(walls.map((w, i) => [w.id, i]))
  const wallById = new Map(walls.map((w) => [w.id, w]))

  type Accum = {
    photo: Photo
    longEdgeCm: number
    count: number
    wallIds: Set<string>
  }
  const groups = new Map<string, Accum>()

  for (const p of placements) {
    const photo = photoById.get(p.photoId)
    if (!photo) continue
    const wall = wallById.get(p.wallId)
    if (!wall) continue
    // Center-in-bounds filter: parked-in-margin placements don't count.
    if (
      p.xCm < 0 ||
      p.xCm > wall.widthCm ||
      p.yCm < 0 ||
      p.yCm > wall.heightCm
    )
      continue
    const key = `${p.photoId}__${p.longEdgeCm}`
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      existing.wallIds.add(p.wallId)
    } else {
      groups.set(key, {
        photo,
        longEdgeCm: p.longEdgeCm,
        count: 1,
        wallIds: new Set([p.wallId]),
      })
    }
  }

  return [...groups.values()].map((g) => {
    const size = computeSizeFromLongEdge(g.longEdgeCm, g.photo.aspectRatio)
    const wallNames = [...g.wallIds]
      .filter((id) => wallNameById.has(id))
      .sort(
        (a, b) =>
          (wallOrder.get(a) ?? Number.POSITIVE_INFINITY) -
          (wallOrder.get(b) ?? Number.POSITIVE_INFINITY),
      )
      .map((id) => wallNameById.get(id) as string)
    return {
      photoId: g.photo.id,
      filename: g.photo.filename,
      blobKey: g.photo.blobKey,
      longEdgeCm: g.longEdgeCm,
      sizeLabel: resolveSizeLabel(g.longEdgeCm),
      widthCm: size.widthCm,
      heightCm: size.heightCm,
      orientation: size.orientation,
      count: g.count,
      wallNames,
    }
  })
}
