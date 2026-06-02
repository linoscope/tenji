import { describe, it, expect } from 'vitest'
import { computeDownscaleSize } from './downscale'

describe('computeDownscaleSize', () => {
  it('caps the long edge at the limit when the image is larger', () => {
    const out = computeDownscaleSize({ width: 3000, height: 2000, longEdgeCap: 1500 })

    expect(out).toEqual({ width: 1500, height: 1000 })
  })

  it('caps a portrait image on its height (the long edge)', () => {
    const out = computeDownscaleSize({ width: 2000, height: 3000, longEdgeCap: 1500 })

    expect(out).toEqual({ width: 1000, height: 1500 })
  })

  it('does not upscale when the image is already smaller than the cap', () => {
    const out = computeDownscaleSize({ width: 800, height: 600, longEdgeCap: 1500 })

    expect(out).toEqual({ width: 800, height: 600 })
  })

  it('preserves square aspect ratio', () => {
    const out = computeDownscaleSize({ width: 4000, height: 4000, longEdgeCap: 1500 })

    expect(out).toEqual({ width: 1500, height: 1500 })
  })

  it('rounds to integer pixel dimensions', () => {
    const out = computeDownscaleSize({ width: 3333, height: 2222, longEdgeCap: 1500 })

    expect(Number.isInteger(out.width)).toBe(true)
    expect(Number.isInteger(out.height)).toBe(true)
    expect(out.width).toBe(1500)
    // 2222 * 1500/3333 = 999.99... → 1000
    expect(out.height).toBe(1000)
  })
})
