import type { Photo, Placement, Wall } from '../state/types'

export type TrayItem = {
  photo: Photo
  placed: boolean
  /** Wall names this photo is placed on — in wall order, deduplicated. */
  wallNames: string[]
}

type Input = {
  photos: Photo[]
  placements: Placement[]
  walls: Wall[]
}

/**
 * Derive the tray view. Every imported photo is returned. A photo is
 * marked placed when it has at least one placement on a known wall.
 * Unplaced items come first in photo order, then placed items in photo
 * order. Placements pointing at a missing photo or wall are ignored,
 * mirroring the print-shop aggregator's tolerance for dangling refs.
 */
export function computeTrayItems({
  photos,
  placements,
  walls,
}: Input): TrayItem[] {
  const wallNameById = new Map(walls.map((w) => [w.id, w.name]))
  const wallOrder = new Map(walls.map((w, i) => [w.id, i]))
  const photoExists = new Set(photos.map((p) => p.id))

  const wallIdsByPhoto = new Map<string, Set<string>>()
  for (const p of placements) {
    if (!photoExists.has(p.photoId)) continue
    if (!wallNameById.has(p.wallId)) continue
    const set = wallIdsByPhoto.get(p.photoId) ?? new Set<string>()
    set.add(p.wallId)
    wallIdsByPhoto.set(p.photoId, set)
  }

  const items: TrayItem[] = photos.map((photo) => {
    const wallIds = wallIdsByPhoto.get(photo.id)
    const wallNames = wallIds
      ? [...wallIds]
          .sort(
            (a, b) =>
              (wallOrder.get(a) ?? Number.POSITIVE_INFINITY) -
              (wallOrder.get(b) ?? Number.POSITIVE_INFINITY),
          )
          .map((id) => wallNameById.get(id) as string)
      : []
    return {
      photo,
      placed: wallNames.length > 0,
      wallNames,
    }
  })

  // Stable partition: unplaced first (in photo order), placed last (in photo order).
  const unplaced = items.filter((i) => !i.placed)
  const placed = items.filter((i) => i.placed)
  return [...unplaced, ...placed]
}
