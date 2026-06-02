import { describe, it, expect } from 'vitest'
import { computeFitScale, cmToPx } from './scale'

describe('computeFitScale', () => {
  it('is limited by width when the wall is wide relative to the viewport', () => {
    const scale = computeFitScale({
      wallWidthCm: 800,
      wallHeightCm: 250,
      viewportWidthPx: 1000,
      viewportHeightPx: 1000,
      marginPx: 0,
    })

    // width is the tighter constraint: 1000 / 800 = 1.25 px per cm
    expect(scale).toBeCloseTo(1.25)
    // the whole wall fits within the viewport
    expect(800 * scale).toBeLessThanOrEqual(1000)
    expect(250 * scale).toBeLessThanOrEqual(1000)
  })

  it('is limited by height when the wall is tall relative to the viewport', () => {
    const scale = computeFitScale({
      wallWidthCm: 100,
      wallHeightCm: 400,
      viewportWidthPx: 1000,
      viewportHeightPx: 800,
      marginPx: 0,
    })

    // height is the tighter constraint: 800 / 400 = 2 px per cm
    expect(scale).toBeCloseTo(2)
  })

  it('reserves a margin around the wall on all sides', () => {
    const scale = computeFitScale({
      wallWidthCm: 100,
      wallHeightCm: 100,
      viewportWidthPx: 220,
      viewportHeightPx: 220,
      marginPx: 10,
    })

    // available space is 220 - 2*10 = 200 in both dims → 2 px per cm
    expect(scale).toBeCloseTo(2)
  })
})

describe('cmToPx', () => {
  it('converts centimeters to pixels using the scale', () => {
    expect(cmToPx(42, 1.25)).toBeCloseTo(52.5)
  })
})
