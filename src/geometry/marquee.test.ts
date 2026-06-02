import { describe, it, expect } from 'vitest'
import {
  computeMarqueeHits,
  normalizeMarqueeRect,
  type MarqueeRect,
} from './marquee'
import type { AlignmentRect } from './alignment'

const rect = (
  id: string,
  centerXCm: number,
  centerYCm: number,
  widthCm = 20,
  heightCm = 20,
): AlignmentRect => ({ id, centerXCm, centerYCm, widthCm, heightCm })

describe('normalizeMarqueeRect', () => {
  it('returns a normalized rect for a top-left to bottom-right drag', () => {
    const norm = normalizeMarqueeRect({
      x1Cm: 10,
      y1Cm: 10,
      x2Cm: 50,
      y2Cm: 30,
    })
    expect(norm).toEqual({ leftCm: 10, topCm: 10, rightCm: 50, bottomCm: 30 })
  })

  it('normalizes a bottom-right to top-left (up-left) drag', () => {
    const norm = normalizeMarqueeRect({
      x1Cm: 50,
      y1Cm: 30,
      x2Cm: 10,
      y2Cm: 10,
    })
    expect(norm).toEqual({ leftCm: 10, topCm: 10, rightCm: 50, bottomCm: 30 })
  })

  it('normalizes a bottom-left to top-right drag', () => {
    const norm = normalizeMarqueeRect({
      x1Cm: 10,
      y1Cm: 30,
      x2Cm: 50,
      y2Cm: 10,
    })
    expect(norm).toEqual({ leftCm: 10, topCm: 10, rightCm: 50, bottomCm: 30 })
  })
})

describe('computeMarqueeHits', () => {
  const box = (left: number, top: number, right: number, bottom: number): MarqueeRect => ({
    leftCm: left,
    topCm: top,
    rightCm: right,
    bottomCm: bottom,
  })

  it('returns placements whose rect overlaps the marquee (touch rule)', () => {
    const placements = [rect('a', 30, 30), rect('b', 100, 100), rect('c', 200, 200)]
    const hits = computeMarqueeHits({ marquee: box(0, 0, 50, 50), placements })
    expect(hits).toEqual(['a'])
  })

  it('counts touching (edge-overlap) as a hit', () => {
    // Placement 'a' centered at (30, 30) with size 20×20 → spans [20,40] × [20,40].
    // Marquee right edge at 20 touches the placement's left edge.
    const placements = [rect('a', 30, 30)]
    const hits = computeMarqueeHits({ marquee: box(0, 0, 20, 20), placements })
    expect(hits).toEqual(['a'])
  })

  it('returns hits in placement input order', () => {
    const placements = [rect('c', 30, 30), rect('a', 35, 35), rect('b', 40, 40)]
    const hits = computeMarqueeHits({ marquee: box(0, 0, 50, 50), placements })
    expect(hits).toEqual(['c', 'a', 'b'])
  })

  it('returns an empty list when the box overlaps nothing', () => {
    const placements = [rect('a', 100, 100)]
    const hits = computeMarqueeHits({ marquee: box(0, 0, 20, 20), placements })
    expect(hits).toEqual([])
  })

  it('handles a marquee in negative/margin cm and selects parked photos there', () => {
    // Photo parked in the left margin at (-30, 100).
    const placements = [rect('a', -30, 100), rect('b', 100, 100)]
    const hits = computeMarqueeHits({
      marquee: box(-50, 50, -10, 150),
      placements,
    })
    expect(hits).toEqual(['a'])
  })

  it('works in any direction (the caller normalizes before passing the box in)', () => {
    const placements = [rect('a', 30, 30)]
    const normalized = normalizeMarqueeRect({
      x1Cm: 100,
      y1Cm: 100,
      x2Cm: 0,
      y2Cm: 0,
    })
    const hits = computeMarqueeHits({ marquee: normalized, placements })
    expect(hits).toEqual(['a'])
  })
})
