/**
 * Pure rubber-band marquee geometry. All values in cm; no DOM, no scale.
 *
 * The marquee uses a "touch" rule: any placement whose axis-aligned cm rect
 * overlaps (or shares an edge with) the marquee rect counts as a hit. Touching
 * placements in the gray margin (negative / out-of-bounds cm) are included.
 */
import type { AlignmentRect } from './alignment'

/** A normalized marquee rectangle (left ≤ right, top ≤ bottom). */
export type MarqueeRect = {
  leftCm: number
  topCm: number
  rightCm: number
  bottomCm: number
}

export type MarqueeEndpoints = {
  x1Cm: number
  y1Cm: number
  x2Cm: number
  y2Cm: number
}

export function normalizeMarqueeRect(e: MarqueeEndpoints): MarqueeRect {
  return {
    leftCm: Math.min(e.x1Cm, e.x2Cm),
    rightCm: Math.max(e.x1Cm, e.x2Cm),
    topCm: Math.min(e.y1Cm, e.y2Cm),
    bottomCm: Math.max(e.y1Cm, e.y2Cm),
  }
}

function placementLeft(p: AlignmentRect): number {
  return p.centerXCm - p.widthCm / 2
}
function placementRight(p: AlignmentRect): number {
  return p.centerXCm + p.widthCm / 2
}
function placementTop(p: AlignmentRect): number {
  return p.centerYCm - p.heightCm / 2
}
function placementBottom(p: AlignmentRect): number {
  return p.centerYCm + p.heightCm / 2
}

export type MarqueeHitInput = {
  marquee: MarqueeRect
  placements: AlignmentRect[]
}

/** Return ids of placements that touch / overlap the marquee, in input order. */
export function computeMarqueeHits({
  marquee,
  placements,
}: MarqueeHitInput): string[] {
  const hits: string[] = []
  for (const p of placements) {
    const overlap =
      placementRight(p) >= marquee.leftCm &&
      placementLeft(p) <= marquee.rightCm &&
      placementBottom(p) >= marquee.topCm &&
      placementTop(p) <= marquee.bottomCm
    if (overlap) hits.push(p.id)
  }
  return hits
}
