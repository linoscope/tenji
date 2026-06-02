import { describe, it, expect } from 'vitest'
import { wallExportFilename } from './filename'

describe('wallExportFilename', () => {
  it('kebab-cases the wall name and appends .png', () => {
    expect(wallExportFilename('North Wall')).toBe('north-wall.png')
  })

  it('strips characters illegal in filenames', () => {
    expect(wallExportFilename('Living / Room: 2!')).toBe('living-room-2.png')
  })

  it('falls back to "wall" when the name is empty after sanitising', () => {
    expect(wallExportFilename('   ')).toBe('wall.png')
    expect(wallExportFilename('!!!')).toBe('wall.png')
  })
})
