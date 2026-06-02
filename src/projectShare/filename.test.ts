import { describe, it, expect } from 'vitest'
import { projectExportFilename } from './filename'

describe('projectExportFilename', () => {
  it('returns tenji-plan-<YYYY-MM-DD>.json', () => {
    expect(projectExportFilename(new Date('2026-06-03T12:34:56Z'))).toBe(
      'tenji-plan-2026-06-03.json',
    )
  })

  it('zero-pads month and day', () => {
    expect(projectExportFilename(new Date('2026-01-05T00:00:00Z'))).toBe(
      'tenji-plan-2026-01-05.json',
    )
  })
})
