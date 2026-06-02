import { describe, it, expect } from 'vitest'
import {
  computeAlignment,
  rectanglesOverlap,
  type AlignmentRect,
} from './alignment'

const wall = { widthCm: 800, heightCm: 250 }

/** Helper: build a centered rectangle in cm. */
function rect(
  id: string,
  centerXCm: number,
  centerYCm: number,
  widthCm: number,
  heightCm: number,
): AlignmentRect {
  return { id, centerXCm, centerYCm, widthCm, heightCm }
}

describe('computeAlignment — wall guides', () => {
  it('snaps to the wall horizontal center when the dragged center is within tolerance', () => {
    const dragged = rect('d', 401, 100, 40, 30) // center 1cm off from wall center (400)
    const result = computeAlignment({
      dragged,
      others: [],
      wall,
      toleranceCm: 2,
    })

    expect(result.snappedCenterXCm).toBe(400)
    expect(result.guides.some((g) => g.kind === 'wall-center-vertical')).toBe(true)
  })

  it('does NOT snap when the dragged center is outside tolerance', () => {
    const dragged = rect('d', 410, 100, 40, 30)
    const result = computeAlignment({
      dragged,
      others: [],
      wall,
      toleranceCm: 2,
    })

    expect(result.snappedCenterXCm).toBe(410)
    expect(result.guides).toHaveLength(0)
  })

  it('snaps to the wall left edge when the dragged left edge is within tolerance', () => {
    const dragged = rect('d', 20.5, 100, 40, 30) // left edge at 0.5cm
    const result = computeAlignment({
      dragged,
      others: [],
      wall,
      toleranceCm: 2,
    })

    expect(result.snappedCenterXCm).toBe(20) // left edge snaps to 0 → center = width/2 = 20
    expect(result.guides.some((g) => g.kind === 'wall-edge-vertical' && g.atCm === 0)).toBe(true)
  })

  it('snaps to the wall vertical center horizontally', () => {
    const dragged = rect('d', 100, 124, 40, 30) // center at y=124, wall center y=125
    const result = computeAlignment({
      dragged,
      others: [],
      wall,
      toleranceCm: 2,
    })

    expect(result.snappedCenterYCm).toBe(125)
    expect(result.guides.some((g) => g.kind === 'wall-center-horizontal')).toBe(true)
  })
})

describe('computeAlignment — sibling guides', () => {
  it("snaps a dragged photo's center-X to another photo's center-X", () => {
    const other = rect('o', 200, 100, 40, 30)
    const dragged = rect('d', 201, 150, 40, 30)
    const result = computeAlignment({
      dragged,
      others: [other],
      wall,
      toleranceCm: 2,
    })

    expect(result.snappedCenterXCm).toBe(200)
    expect(
      result.guides.some((g) => g.kind === 'sibling-center-vertical' && g.atCm === 200),
    ).toBe(true)
  })

  it("snaps a dragged photo's left edge to another photo's left edge", () => {
    // Sibling is wider so center alignment is too far away — only edges line up.
    const other = rect('o', 220, 100, 80, 30) // left edge = 180
    const dragged = rect('d', 200.5, 150, 40, 30) // left edge = 180.5
    const result = computeAlignment({
      dragged,
      others: [other],
      wall,
      toleranceCm: 2,
    })

    // Dragged left edge should snap to 180, so center = 180 + 20 = 200.
    expect(result.snappedCenterXCm).toBe(200)
    expect(
      result.guides.some(
        (g) => g.kind === 'sibling-edge-vertical' && g.atCm === 180,
      ),
    ).toBe(true)
  })

  it("snaps a dragged photo's top edge to another photo's bottom edge", () => {
    const other = rect('o', 200, 100, 40, 30) // bottom = 115
    const dragged = rect('d', 300, 130.5, 40, 30) // top = 115.5
    const result = computeAlignment({
      dragged,
      others: [other],
      wall,
      toleranceCm: 2,
    })

    // Dragged top should snap to 115, so center = 115 + 15 = 130.
    expect(result.snappedCenterYCm).toBe(130)
    expect(
      result.guides.some(
        (g) => g.kind === 'sibling-edge-horizontal' && g.atCm === 115,
      ),
    ).toBe(true)
  })

  it('snap activates exactly within tolerance and not just beyond it', () => {
    const other = rect('o', 200, 100, 40, 30)
    const inside = computeAlignment({
      dragged: rect('d', 201.99, 150, 40, 30),
      others: [other],
      wall,
      toleranceCm: 2,
    })
    expect(inside.snappedCenterXCm).toBe(200)

    const outside = computeAlignment({
      dragged: rect('d', 202.5, 150, 40, 30),
      others: [other],
      wall,
      toleranceCm: 2,
    })
    expect(outside.snappedCenterXCm).toBe(202.5)
  })

  it('picks the nearest candidate when multiple guides are within tolerance', () => {
    const a = rect('a', 100, 100, 40, 30)
    const b = rect('b', 105, 100, 40, 30)
    const dragged = rect('d', 103, 150, 40, 30) // closer to 105 than to 100
    const result = computeAlignment({
      dragged,
      others: [a, b],
      wall,
      toleranceCm: 5,
    })

    expect(result.snappedCenterXCm).toBe(105)
  })
})

describe('computeAlignment — gap measurements', () => {
  it("measures the horizontal cm gap between the dragged photo and its left neighbour", () => {
    const left = rect('o', 100, 150, 40, 30) // right edge = 120
    const dragged = rect('d', 200, 150, 40, 30) // left edge = 180
    const result = computeAlignment({
      dragged,
      others: [left],
      wall,
      toleranceCm: 2,
    })

    // Gap = 180 - 120 = 60.
    const gap = result.gaps.find((g) => g.otherId === 'o')
    expect(gap).toBeDefined()
    expect(gap?.gapCm).toBeCloseTo(60)
    expect(gap?.axis).toBe('horizontal')
  })

  it("measures the vertical cm gap when the neighbour is above", () => {
    const above = rect('o', 200, 50, 40, 30) // bottom = 65
    const dragged = rect('d', 200, 150, 40, 30) // top = 135
    const result = computeAlignment({
      dragged,
      others: [above],
      wall,
      toleranceCm: 2,
    })

    const gap = result.gaps.find((g) => g.otherId === 'o')
    expect(gap).toBeDefined()
    expect(gap?.gapCm).toBeCloseTo(70)
    expect(gap?.axis).toBe('vertical')
  })

  it('does not include a gap entry for non-neighbours (no axis overlap on either side)', () => {
    // far away in both axes, won't be a sensible "gap to neighbour"
    const other = rect('o', 50, 50, 40, 30)
    const dragged = rect('d', 700, 200, 40, 30)
    const result = computeAlignment({
      dragged,
      others: [other],
      wall,
      toleranceCm: 2,
    })

    expect(result.gaps.find((g) => g.otherId === 'o')).toBeUndefined()
  })
})

describe('rectanglesOverlap', () => {
  it('returns true when two rectangles overlap', () => {
    const a = rect('a', 100, 100, 40, 30) // 80..120 x 85..115
    const b = rect('b', 110, 100, 40, 30) // 90..130 overlaps
    expect(rectanglesOverlap(a, b)).toBe(true)
  })

  it('returns false when rectangles only touch on an edge', () => {
    const a = rect('a', 100, 100, 40, 30) // right edge = 120
    const b = rect('b', 140, 100, 40, 30) // left edge = 120
    expect(rectanglesOverlap(a, b)).toBe(false)
  })

  it('returns false when rectangles are clearly separate', () => {
    const a = rect('a', 100, 100, 40, 30)
    const b = rect('b', 300, 100, 40, 30)
    expect(rectanglesOverlap(a, b)).toBe(false)
  })
})
