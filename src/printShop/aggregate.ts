import type { Photo, Placement, Wall } from '../state/types'
import {
  resolvePlacementSize,
  resolveSizeLabel,
  type Orientation,
} from '../geometry/sizing'

export type PrintRow = {
  photoId: string
  filename: string
  blobKey: string
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

const DIM_KEY = (cm: number) => Math.round(cm * 1000) / 1000

/**
 * Group placements across all walls by (photoId, resolved widthCm, heightCm).
 * Only placements whose **center is inside the wall bounds** count — margin-
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
    widthCm: number
    heightCm: number
    orientation: Orientation
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
    const resolved = resolvePlacementSize(p.size, photo.aspectRatio)
    const key = `${p.photoId}__${DIM_KEY(resolved.widthCm)}x${DIM_KEY(
      resolved.heightCm,
    )}`
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      existing.wallIds.add(p.wallId)
    } else {
      groups.set(key, {
        photo,
        widthCm: resolved.widthCm,
        heightCm: resolved.heightCm,
        orientation: resolved.orientation,
        count: 1,
        wallIds: new Set([p.wallId]),
      })
    }
  }

  return [...groups.values()].map((g) => {
    const wallNames = [...g.wallIds]
      .filter((id) => wallNameById.has(id))
      .sort(
        (a, b) =>
          (wallOrder.get(a) ?? Number.POSITIVE_INFINITY) -
          (wallOrder.get(b) ?? Number.POSITIVE_INFINITY),
      )
      .map((id) => wallNameById.get(id) as string)
    const longEdge = Math.max(g.widthCm, g.heightCm)
    return {
      photoId: g.photo.id,
      filename: g.photo.filename,
      blobKey: g.photo.blobKey,
      sizeLabel: resolveSizeLabel(longEdge),
      widthCm: g.widthCm,
      heightCm: g.heightCm,
      orientation: g.orientation,
      count: g.count,
      wallNames,
    }
  })
}
