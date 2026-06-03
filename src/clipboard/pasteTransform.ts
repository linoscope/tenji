/**
 * Pure helpers for the in-app clipboard. No DOM, no React.
 *
 * `buildClipboardEntries` captures the selected placements as descriptors —
 * photoId + longEdgeCm + the placement's offset from the cluster centroid —
 * so that paste can reproduce the cluster's relative arrangement on any wall.
 *
 * `computePastePositions` turns those descriptors into concrete (xCm, yCm)
 * centers on a target wall. It anchors on the originals' centroid, optionally
 * applies a small nudge for same-wall paste (so copies don't sit exactly on
 * top of the originals), and clamps the whole cluster into the target wall
 * while preserving the shape of the arrangement.
 */

/** Same-wall paste offsets every copy by this many cm so they don't overlap exactly. */
export const SAME_WALL_PASTE_OFFSET_CM = 8

export type ClipboardEntry = {
  photoId: string
  longEdgeCm: number
  /** x offset from the cluster's centroid at copy time. */
  dxCm: number
  /** y offset from the cluster's centroid at copy time. */
  dyCm: number
}

export type ClipboardSource = {
  id: string
  photoId: string
  wallId: string
  xCm: number
  yCm: number
  longEdgeCm: number
}

/** Compute the descriptor list + the cluster's centroid coordinates. */
export function buildClipboardEntries(
  sources: ClipboardSource[],
): ClipboardEntry[] {
  if (sources.length === 0) return []
  const centroid = computeCentroid(sources)
  return sources.map((s) => ({
    photoId: s.photoId,
    longEdgeCm: s.longEdgeCm,
    dxCm: s.xCm - centroid.xCm,
    dyCm: s.yCm - centroid.yCm,
  }))
}

export function computeCentroid(
  sources: { xCm: number; yCm: number }[],
): { xCm: number; yCm: number } {
  if (sources.length === 0) return { xCm: 0, yCm: 0 }
  let sx = 0
  let sy = 0
  for (const s of sources) {
    sx += s.xCm
    sy += s.yCm
  }
  return { xCm: sx / sources.length, yCm: sy / sources.length }
}

export type PastePositionsInput = {
  entries: ClipboardEntry[]
  /** Centroid of the originals at copy time (in their source wall's coords). */
  sourceCenter: { xCm: number; yCm: number }
  /** True if pasting onto the same wall the originals live on. */
  sameWall: boolean
  /** The destination wall's size in cm — used to clamp the cluster center. */
  wall: { widthCm: number; heightCm: number }
}

export type PastePosition = {
  xCm: number
  yCm: number
  longEdgeCm: number
}

/**
 * Compute the target wall coordinates for each pasted placement.
 *
 * Anchoring: the cluster's centroid lands at `sourceCenter` (i.e. copies sit at
 * the same coordinates as the originals). On same-wall paste, the anchor is
 * nudged by `SAME_WALL_PASTE_OFFSET_CM` so copies don't overlap the originals.
 *
 * Clamping: the centroid is clamped so that every center sits inside the wall;
 * because every copy shifts by the same delta, the cluster's relative shape is
 * preserved.
 */
export function computePastePositions({
  entries,
  sourceCenter,
  sameWall,
  wall,
}: PastePositionsInput): PastePosition[] {
  if (entries.length === 0) return []
  let anchorX = sourceCenter.xCm
  let anchorY = sourceCenter.yCm
  if (sameWall) {
    anchorX += SAME_WALL_PASTE_OFFSET_CM
    anchorY += SAME_WALL_PASTE_OFFSET_CM
  }

  // Find the cluster's bounding box of centers (in offsets from the anchor),
  // then shift the anchor so every center lands inside [0, wall.size].
  let minDx = Infinity
  let maxDx = -Infinity
  let minDy = Infinity
  let maxDy = -Infinity
  for (const e of entries) {
    if (e.dxCm < minDx) minDx = e.dxCm
    if (e.dxCm > maxDx) maxDx = e.dxCm
    if (e.dyCm < minDy) minDy = e.dyCm
    if (e.dyCm > maxDy) maxDy = e.dyCm
  }

  const minXAllowed = -minDx
  const maxXAllowed = wall.widthCm - maxDx
  const minYAllowed = -minDy
  const maxYAllowed = wall.heightCm - maxDy
  // If the cluster span exceeds the wall, the [min,max] window collapses; in
  // that case prefer the lower bound (top-left corner) so the cluster keeps
  // its shape and still has *some* center inside the wall.
  if (minXAllowed <= maxXAllowed) {
    anchorX = clamp(anchorX, minXAllowed, maxXAllowed)
  } else {
    anchorX = minXAllowed
  }
  if (minYAllowed <= maxYAllowed) {
    anchorY = clamp(anchorY, minYAllowed, maxYAllowed)
  } else {
    anchorY = minYAllowed
  }

  return entries.map((e) => ({
    xCm: anchorX + e.dxCm,
    yCm: anchorY + e.dyCm,
    longEdgeCm: e.longEdgeCm,
  }))
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
