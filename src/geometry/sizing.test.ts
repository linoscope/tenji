import { describe, it, expect } from 'vitest'
import { computeSizeFromLongEdge } from './sizing'

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
