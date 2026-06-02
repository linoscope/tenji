import { describe, it, expect } from 'vitest'
import { computeRulerTicks, SILHOUETTE_HEIGHT_CM } from './overlays'

describe('computeRulerTicks', () => {
  it('returns 0, the spacing, and the wall length when length is a multiple of spacing', () => {
    expect(computeRulerTicks(200, 50)).toEqual([0, 50, 100, 150, 200])
  })

  it('includes the final wall edge tick even when length is not a multiple of spacing', () => {
    expect(computeRulerTicks(230, 50)).toEqual([0, 50, 100, 150, 200, 230])
  })

  it('returns just [0, length] when the spacing is larger than the wall', () => {
    expect(computeRulerTicks(40, 50)).toEqual([0, 40])
  })

  it('does not duplicate the final tick when length lands exactly on a spacing step', () => {
    const ticks = computeRulerTicks(100, 50)
    expect(ticks).toEqual([0, 50, 100])
    expect(new Set(ticks).size).toBe(ticks.length)
  })
})

describe('SILHOUETTE_HEIGHT_CM', () => {
  it('is roughly average adult human height in cm', () => {
    expect(SILHOUETTE_HEIGHT_CM).toBe(170)
  })
})
