import { describe, it, expect } from 'vitest'
import { printRowsToCsv, printShopCsvFilename } from './csv'
import type { PrintRow } from './aggregate'

const row = (overrides: Partial<PrintRow> = {}): PrintRow => ({
  photoId: 'p1',
  filename: 'sunset.jpg',
  blobKey: 'blob-p1',
  longEdgeCm: 42,
  sizeLabel: 'A3',
  widthCm: 42,
  heightCm: 28,
  orientation: 'landscape',
  count: 1,
  wallNames: ['North'],
  ...overrides,
})

describe('printRowsToCsv', () => {
  it('emits a header row followed by one row per print row, omitting the thumbnail', () => {
    const csv = printRowsToCsv([row()])
    const [header, body] = csv.trim().split('\n')

    expect(header).toBe(
      'Filename,Size,Width (cm),Height (cm),Orientation,Count,Walls',
    )
    expect(body).toBe('sunset.jpg,A3,42,28,landscape,1,North')
  })

  it('joins multiple wall names with a semicolon inside a single CSV field', () => {
    const csv = printRowsToCsv([row({ wallNames: ['North', 'South'] })])

    expect(csv).toContain('North; South')
  })

  it('quotes and escapes fields that contain commas, quotes, or newlines', () => {
    const csv = printRowsToCsv([
      row({
        filename: 'a, "weird".jpg',
        wallNames: ['Lobby, East'],
      }),
    ])

    expect(csv).toContain('"a, ""weird"".jpg"')
    expect(csv).toContain('"Lobby, East"')
  })

  it('renders Custom size labels and rounds W/H to two decimals when needed', () => {
    const csv = printRowsToCsv([
      row({
        sizeLabel: 'Custom',
        longEdgeCm: 29.7,
        widthCm: 29.7,
        heightCm: 19.8,
      }),
    ])

    expect(csv).toContain('Custom,29.7,19.8')
  })

  it('returns just the header when there are no rows', () => {
    expect(printRowsToCsv([])).toBe(
      'Filename,Size,Width (cm),Height (cm),Orientation,Count,Walls\n',
    )
  })
})

describe('printShopCsvFilename', () => {
  it("is a stable, kebab-cased filename ending in .csv", () => {
    expect(printShopCsvFilename()).toBe('print-list.csv')
  })
})
