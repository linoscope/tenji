/**
 * Pure alignment / snapping / gap geometry. All inputs and outputs are in cm.
 * No DOM, no React, no scale.
 */

export type AlignmentRect = {
  id: string
  /** Wall-relative cm of the rectangle's center. */
  centerXCm: number
  centerYCm: number
  widthCm: number
  heightCm: number
}

export type AlignmentWall = {
  widthCm: number
  heightCm: number
}

export type GuideKind =
  | 'wall-center-vertical'
  | 'wall-center-horizontal'
  | 'wall-edge-vertical'
  | 'wall-edge-horizontal'
  | 'sibling-center-vertical'
  | 'sibling-center-horizontal'
  | 'sibling-edge-vertical'
  | 'sibling-edge-horizontal'

export type Guide = {
  kind: GuideKind
  /** The cm coordinate along the axis perpendicular to the guide line. */
  atCm: number
  /** id of the sibling that produced the guide; null for wall guides. */
  siblingId: string | null
}

export type GapAxis = 'horizontal' | 'vertical'

export type Gap = {
  otherId: string
  axis: GapAxis
  gapCm: number
  /** Midpoint of the gap segment in cm (for labelling). */
  midXCm: number
  midYCm: number
}

export type AlignmentInput = {
  dragged: AlignmentRect
  others: AlignmentRect[]
  wall: AlignmentWall
  toleranceCm: number
}

export type AlignmentResult = {
  snappedCenterXCm: number
  snappedCenterYCm: number
  guides: Guide[]
  gaps: Gap[]
}

type Candidate = {
  /** The dragged rectangle's reference value (center, left edge, right edge). */
  draggedValue: number
  /** The candidate target value to snap that reference to. */
  targetValue: number
  guide: Guide
}

function leftEdge(r: AlignmentRect): number {
  return r.centerXCm - r.widthCm / 2
}
function rightEdge(r: AlignmentRect): number {
  return r.centerXCm + r.widthCm / 2
}
function topEdge(r: AlignmentRect): number {
  return r.centerYCm - r.heightCm / 2
}
function bottomEdge(r: AlignmentRect): number {
  return r.centerYCm + r.heightCm / 2
}

function pickBest(candidates: Candidate[], toleranceCm: number): Candidate | null {
  let best: Candidate | null = null
  let bestDelta = Infinity
  for (const c of candidates) {
    const delta = Math.abs(c.draggedValue - c.targetValue)
    if (delta <= toleranceCm && delta < bestDelta) {
      best = c
      bestDelta = delta
    }
  }
  return best
}

function xCandidates(
  dragged: AlignmentRect,
  others: AlignmentRect[],
  wall: AlignmentWall,
): Candidate[] {
  const out: Candidate[] = []
  // Wall center.
  out.push({
    draggedValue: dragged.centerXCm,
    targetValue: wall.widthCm / 2,
    guide: {
      kind: 'wall-center-vertical',
      atCm: wall.widthCm / 2,
      siblingId: null,
    },
  })
  // Wall edges via dragged edges.
  out.push({
    draggedValue: leftEdge(dragged),
    targetValue: 0,
    guide: { kind: 'wall-edge-vertical', atCm: 0, siblingId: null },
  })
  out.push({
    draggedValue: rightEdge(dragged),
    targetValue: wall.widthCm,
    guide: { kind: 'wall-edge-vertical', atCm: wall.widthCm, siblingId: null },
  })
  // Sibling centers + edges.
  for (const o of others) {
    out.push({
      draggedValue: dragged.centerXCm,
      targetValue: o.centerXCm,
      guide: {
        kind: 'sibling-center-vertical',
        atCm: o.centerXCm,
        siblingId: o.id,
      },
    })
    // Left-to-left, right-to-right (line up edges).
    out.push({
      draggedValue: leftEdge(dragged),
      targetValue: leftEdge(o),
      guide: {
        kind: 'sibling-edge-vertical',
        atCm: leftEdge(o),
        siblingId: o.id,
      },
    })
    out.push({
      draggedValue: rightEdge(dragged),
      targetValue: rightEdge(o),
      guide: {
        kind: 'sibling-edge-vertical',
        atCm: rightEdge(o),
        siblingId: o.id,
      },
    })
    // Right-to-left, left-to-right (line up adjacent edges).
    out.push({
      draggedValue: rightEdge(dragged),
      targetValue: leftEdge(o),
      guide: {
        kind: 'sibling-edge-vertical',
        atCm: leftEdge(o),
        siblingId: o.id,
      },
    })
    out.push({
      draggedValue: leftEdge(dragged),
      targetValue: rightEdge(o),
      guide: {
        kind: 'sibling-edge-vertical',
        atCm: rightEdge(o),
        siblingId: o.id,
      },
    })
  }
  return out
}

function yCandidates(
  dragged: AlignmentRect,
  others: AlignmentRect[],
  wall: AlignmentWall,
): Candidate[] {
  const out: Candidate[] = []
  out.push({
    draggedValue: dragged.centerYCm,
    targetValue: wall.heightCm / 2,
    guide: {
      kind: 'wall-center-horizontal',
      atCm: wall.heightCm / 2,
      siblingId: null,
    },
  })
  out.push({
    draggedValue: topEdge(dragged),
    targetValue: 0,
    guide: { kind: 'wall-edge-horizontal', atCm: 0, siblingId: null },
  })
  out.push({
    draggedValue: bottomEdge(dragged),
    targetValue: wall.heightCm,
    guide: { kind: 'wall-edge-horizontal', atCm: wall.heightCm, siblingId: null },
  })
  for (const o of others) {
    out.push({
      draggedValue: dragged.centerYCm,
      targetValue: o.centerYCm,
      guide: {
        kind: 'sibling-center-horizontal',
        atCm: o.centerYCm,
        siblingId: o.id,
      },
    })
    out.push({
      draggedValue: topEdge(dragged),
      targetValue: topEdge(o),
      guide: {
        kind: 'sibling-edge-horizontal',
        atCm: topEdge(o),
        siblingId: o.id,
      },
    })
    out.push({
      draggedValue: bottomEdge(dragged),
      targetValue: bottomEdge(o),
      guide: {
        kind: 'sibling-edge-horizontal',
        atCm: bottomEdge(o),
        siblingId: o.id,
      },
    })
    out.push({
      draggedValue: bottomEdge(dragged),
      targetValue: topEdge(o),
      guide: {
        kind: 'sibling-edge-horizontal',
        atCm: topEdge(o),
        siblingId: o.id,
      },
    })
    out.push({
      draggedValue: topEdge(dragged),
      targetValue: bottomEdge(o),
      guide: {
        kind: 'sibling-edge-horizontal',
        atCm: bottomEdge(o),
        siblingId: o.id,
      },
    })
  }
  return out
}

/** Range-overlap test on a single axis (with no tolerance — pure overlap). */
function axisOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax && bMin < aMax
}

function gapFor(dragged: AlignmentRect, other: AlignmentRect): Gap | null {
  const dLeft = leftEdge(dragged)
  const dRight = rightEdge(dragged)
  const dTop = topEdge(dragged)
  const dBottom = bottomEdge(dragged)
  const oLeft = leftEdge(other)
  const oRight = rightEdge(other)
  const oTop = topEdge(other)
  const oBottom = bottomEdge(other)

  const xOverlap = axisOverlap(dLeft, dRight, oLeft, oRight)
  const yOverlap = axisOverlap(dTop, dBottom, oTop, oBottom)

  // Horizontal gap requires their y-ranges to overlap (they sit at the same height-ish).
  if (yOverlap && !xOverlap) {
    if (dLeft >= oRight) {
      // other is to the left of dragged
      const gapCm = dLeft - oRight
      return {
        otherId: other.id,
        axis: 'horizontal',
        gapCm,
        midXCm: (oRight + dLeft) / 2,
        midYCm:
          (Math.max(dTop, oTop) + Math.min(dBottom, oBottom)) / 2,
      }
    }
    if (oLeft >= dRight) {
      // other is to the right of dragged
      const gapCm = oLeft - dRight
      return {
        otherId: other.id,
        axis: 'horizontal',
        gapCm,
        midXCm: (dRight + oLeft) / 2,
        midYCm:
          (Math.max(dTop, oTop) + Math.min(dBottom, oBottom)) / 2,
      }
    }
  }
  // Vertical gap requires their x-ranges to overlap.
  if (xOverlap && !yOverlap) {
    if (dTop >= oBottom) {
      const gapCm = dTop - oBottom
      return {
        otherId: other.id,
        axis: 'vertical',
        gapCm,
        midXCm:
          (Math.max(dLeft, oLeft) + Math.min(dRight, oRight)) / 2,
        midYCm: (oBottom + dTop) / 2,
      }
    }
    if (oTop >= dBottom) {
      const gapCm = oTop - dBottom
      return {
        otherId: other.id,
        axis: 'vertical',
        gapCm,
        midXCm:
          (Math.max(dLeft, oLeft) + Math.min(dRight, oRight)) / 2,
        midYCm: (dBottom + oTop) / 2,
      }
    }
  }
  return null
}

export function computeAlignment(input: AlignmentInput): AlignmentResult {
  const { dragged, others, wall, toleranceCm } = input

  const bestX = pickBest(xCandidates(dragged, others, wall), toleranceCm)
  const bestY = pickBest(yCandidates(dragged, others, wall), toleranceCm)

  const snappedCenterXCm = bestX
    ? dragged.centerXCm + (bestX.targetValue - bestX.draggedValue)
    : dragged.centerXCm
  const snappedCenterYCm = bestY
    ? dragged.centerYCm + (bestY.targetValue - bestY.draggedValue)
    : dragged.centerYCm

  const guides: Guide[] = []
  if (bestX) guides.push(bestX.guide)
  if (bestY) guides.push(bestY.guide)

  const snappedRect: AlignmentRect = {
    ...dragged,
    centerXCm: snappedCenterXCm,
    centerYCm: snappedCenterYCm,
  }
  const gaps: Gap[] = []
  for (const o of others) {
    const g = gapFor(snappedRect, o)
    if (g) gaps.push(g)
  }

  return { snappedCenterXCm, snappedCenterYCm, guides, gaps }
}

export function rectanglesOverlap(a: AlignmentRect, b: AlignmentRect): boolean {
  return (
    axisOverlap(leftEdge(a), rightEdge(a), leftEdge(b), rightEdge(b)) &&
    axisOverlap(topEdge(a), bottomEdge(a), topEdge(b), bottomEdge(b))
  )
}
