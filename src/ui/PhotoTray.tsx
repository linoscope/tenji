import { useEffect, useRef, useState } from 'react'
import type { Photo } from '../state/types'
import type { BlobStore } from '../storage/blobStore'
import type { TrayItem } from '../tray/trayView'

type PhotoTrayProps = {
  items: TrayItem[]
  blobStore: BlobStore
  onImportFiles: (files: FileList | File[]) => void
}

export default function PhotoTray({
  items,
  blobStore,
  onImportFiles,
}: PhotoTrayProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFiles(e.target.files)
      e.target.value = ''
    }
  }
  return (
    <section
      style={{
        borderTop: '1px solid #d0d0d0',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 12 }}>Tray</strong>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{ fontSize: 12 }}
        >
          + Photos
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPickFiles}
        aria-label="Import photos"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1 }}
      />
      <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
        Drop, paste, or pick image files.
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
        }}
      >
        {items.map((item) => (
          <TrayPhoto
            key={item.photo.id}
            item={item}
            blobStore={blobStore}
          />
        ))}
      </ul>
    </section>
  )
}

function TrayPhoto({
  item,
  blobStore,
}: {
  item: TrayItem
  blobStore: BlobStore
}) {
  const { photo, placed, wallNames } = item
  const caption = placedCaption(wallNames)
  return (
    <li
      data-testid={`tray-photo-${photo.id}`}
      data-placed={placed ? 'true' : 'false'}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-tenji-photo', photo.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      style={{
        border: '1px solid #d0d0d0',
        borderRadius: 4,
        overflow: 'hidden',
        aspectRatio: '1 / 1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        background: '#fff',
        cursor: 'grab',
        opacity: placed ? 0.5 : 1,
        position: 'relative',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Thumbnail photo={photo} blobStore={blobStore} />
      </div>
      {caption ? (
        <div
          data-testid={`tray-caption-${photo.id}`}
          style={{
            fontSize: 9,
            lineHeight: 1.2,
            padding: '2px 4px',
            color: '#fff',
            background: 'rgba(0,0,0,0.55)',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {caption}
        </div>
      ) : null}
    </li>
  )
}

function placedCaption(wallNames: string[]): string | null {
  if (wallNames.length === 0) return null
  if (wallNames.length === 1) return wallNames[0]
  return `On: ${wallNames.length} walls`
}

function Thumbnail({
  photo,
  blobStore,
}: {
  photo: Photo
  blobStore: BlobStore
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null
    blobStore.load(photo.blobKey).then((blob) => {
      if (cancelled || !blob) return
      createdUrl = URL.createObjectURL(blob)
      setUrl(createdUrl)
    })
    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [photo.blobKey, blobStore])

  if (!url) {
    return <span style={{ fontSize: 10, color: '#999' }}>{photo.filename}</span>
  }
  return (
    <img
      src={url}
      alt={photo.filename}
      style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
    />
  )
}
