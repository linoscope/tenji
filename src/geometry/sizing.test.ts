import { describe, it, expect } from 'vitest'
import {
  A_SERIES_PRESETS,
  computeSizeFromLongEdge,
  resolvePlacementSize,
  resolveSizeLabel,
} from './sizing'

describe('computeSizeFromLongEdge', () => {
  it('makes the long edge the width when the image is landscape (aspect > 1)', () => {
    const size = computeSizeFromLongEdge(42, 3 / 2)

    expect(size.widthCm).toBeCloseTo(42)
    expect(size.heightCm).toBeCloseTo(28)
    expect(size.orientation).toBe('landscape')
  })

  it('makes the long edge the height when the image is portrait (aspect < 1)', () => {
    const size = computeSizeFromLongEdge(42, 2 / 3)

    expect(size.widthCm).toBeCloseTo(28)
    expect(size.heightCm).toBeCloseTo(42)
    expect(size.orientation).toBe('portrait')
  })

  it('makes a square photo (aspect = 1) widthCm == heightCm == longEdge', () => {
    const size = computeSizeFromLongEdge(42, 1)

    expect(size.widthCm).toBeCloseTo(42)
    expect(size.heightCm).toBeCloseTo(42)
    expect(size.orientation).toBe('square')
  })
})

describe('A_SERIES_PRESETS', () => {
  it('maps A5..A0 to the expected long-edge cm', () => {
    expect(A_SERIES_PRESETS).toEqual([
      { label: 'A5', longEdgeCm: 21 },
      { label: 'A4', longEdgeCm: 29.7 },
      { label: 'A3', longEdgeCm: 42 },
      { label: 'A2', longEdgeCm: 59.4 },
      { label: 'A1', longEdgeCm: 84.1 },
      { label: 'A0', longEdgeCm: 118.9 },
    ])
  })
})

describe('resolveSizeLabel', () => {
  it("returns the preset label when the long edge matches a preset's", () => {
    expect(resolveSizeLabel(21)).toBe('A5')
    expect(resolveSizeLabel(29.7)).toBe('A4')
    expect(resolveSizeLabel(42)).toBe('A3')
    expect(resolveSizeLabel(59.4)).toBe('A2')
    expect(resolveSizeLabel(84.1)).toBe('A1')
    expect(resolveSizeLabel(118.9)).toBe('A0')
  })

  it("returns 'Custom' when the long edge does not match any preset", () => {
    expect(resolveSizeLabel(30)).toBe('Custom')
    expect(resolveSizeLabel(50)).toBe('Custom')
  })

  it('tolerates tiny float drift around a preset', () => {
    expect(resolveSizeLabel(42.0000001)).toBe('A3')
    expect(resolveSizeLabel(29.69999)).toBe('A4')
  })
})

describe('resolvePlacementSize', () => {
  it('aspect mode uses the photo aspect ratio (long edge becomes width on landscape)', () => {
    const result = resolvePlacementSize(
      { mode: 'aspect', longEdgeCm: 42 },
      3 / 2,
    )

    expect(result.widthCm).toBeCloseTo(42)
    expect(result.heightCm).toBeCloseTo(28)
    expect(result.orientation).toBe('landscape')
  })

  it('aspect mode uses the photo aspect ratio (long edge becomes height on portrait)', () => {
    const result = resolvePlacementSize(
      { mode: 'aspect', longEdgeCm: 42 },
      2 / 3,
    )

    expect(result.widthCm).toBeCloseTo(28)
    expect(result.heightCm).toBeCloseTo(42)
    expect(result.orientation).toBe('portrait')
  })

  it('crop mode passes width/height through and ignores the photo aspect ratio', () => {
    const result = resolvePlacementSize(
      { mode: 'crop', widthCm: 30, heightCm: 40 },
      2 / 3,
    )

    expect(result.widthCm).toBe(30)
    expect(result.heightCm).toBe(40)
    expect(result.orientation).toBe('portrait')
  })

  it('crop mode reports landscape when widthCm > heightCm regardless of photo aspect', () => {
    const result = resolvePlacementSize(
      { mode: 'crop', widthCm: 42, heightCm: 29.7 },
      2 / 3, // portrait photo, but crop is landscape
    )

    expect(result.orientation).toBe('landscape')
  })

  it('crop mode reports square when widthCm == heightCm', () => {
    const result = resolvePlacementSize(
      { mode: 'crop', widthCm: 30, heightCm: 30 },
      1.5,
    )

    expect(result.orientation).toBe('square')
  })
})
