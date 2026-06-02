import type { PrintRow } from './aggregate'

const HEADER = [
  'Filename',
  'Size',
  'Width (cm)',
  'Height (cm)',
  'Orientation',
  'Count',
  'Walls',
] as const

function escape(field: string): string {
  if (/[",\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

function formatCm(cm: number): string {
  // Drop trailing zeros: 42 → "42", 19.8 → "19.8", 29.70 → "29.7"
  const rounded = Math.round(cm * 100) / 100
  return String(rounded)
}

export function printRowsToCsv(rows: PrintRow[]): string {
  const lines = [HEADER.join(',')]
  for (const row of rows) {
    lines.push(
      [
        escape(row.filename),
        escape(row.sizeLabel),
        formatCm(row.widthCm),
        formatCm(row.heightCm),
        row.orientation,
        String(row.count),
        escape(row.wallNames.join('; ')),
      ].join(','),
    )
  }
  return lines.join('\n') + '\n'
}

export function printShopCsvFilename(): string {
  return 'print-list.csv'
}
