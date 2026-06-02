import { useEffect, useState } from 'react'
import type { Photo, Placement, Wall } from '../state/types'
import type { BlobStore } from '../storage/blobStore'
import { aggregatePrintRows, type PrintRow } from '../printShop/aggregate'
import { printRowsToCsv, printShopCsvFilename } from '../printShop/csv'

type PrintShopProps = {
  photos: Photo[]
  placements: Placement[]
  walls: Wall[]
  blobStore: BlobStore
  downloadBlob: (blob: Blob, filename: string) => void
}

export default function PrintShop({
  photos,
  placements,
  walls,
  blobStore,
  downloadBlob,
}: PrintShopProps) {
  const rows = aggregatePrintRows({ photos, placements, walls })

  const handleDownload = () => {
    const csv = printRowsToCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, printShopCsvFilename())
  }

  return (
    <section
      data-testid="print-shop"
      style={{
        borderTop: '1px solid #d0d0d0',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <strong style={{ fontSize: 12 }}>Print list</strong>
        <button
          type="button"
          onClick={handleDownload}
          disabled={rows.length === 0}
          style={{ fontSize: 12 }}
        >
          Download CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
          Place photos on walls to populate the print list.
        </p>
      ) : (
        <table
          data-testid="print-shop-table"
          style={{
            borderCollapse: 'collapse',
            fontSize: 11,
            width: '100%',
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', color: '#666' }}>
              <th></th>
              <th>File</th>
              <th>Size</th>
              <th>W×H</th>
              <th>Orient.</th>
              <th>#</th>
              <th>Walls</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PrintRowView
                key={`${row.photoId}-${row.longEdgeCm}`}
                row={row}
                blobStore={blobStore}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function PrintRowView({
  row,
  blobStore,
}: {
  row: PrintRow
  blobStore: BlobStore
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null
    blobStore.load(row.blobKey).then((blob) => {
      if (cancelled || !blob) return
      createdUrl = URL.createObjectURL(blob)
      setUrl(createdUrl)
    })
    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [row.blobKey, blobStore])

  return (
    <tr
      data-testid={`print-row-${row.photoId}-${row.longEdgeCm}`}
      style={{ borderTop: '1px solid #eee', verticalAlign: 'middle' }}
    >
      <td style={{ width: 32 }}>
        {url ? (
          <img
            src={url}
            alt={row.filename}
            style={{
              width: 28,
              height: 28,
              objectFit: 'cover',
              display: 'block',
              borderRadius: 2,
            }}
          />
        ) : (
          <div style={{ width: 28, height: 28, background: '#eee' }} />
        )}
      </td>
      <td data-cell="filename">{row.filename}</td>
      <td data-cell="size">{row.sizeLabel}</td>
      <td data-cell="dimensions">
        {formatCm(row.widthCm)}×{formatCm(row.heightCm)} cm
      </td>
      <td data-cell="orientation">{row.orientation}</td>
      <td data-cell="count">{row.count}</td>
      <td data-cell="walls">{row.wallNames.join(', ')}</td>
    </tr>
  )
}

function formatCm(cm: number): string {
  const rounded = Math.round(cm * 100) / 100
  return String(rounded)
}
