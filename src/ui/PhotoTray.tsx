import { useEffect, useRef, useState } from 'react'
import type { Photo } from '../state/types'
import type { BlobStore } from '../storage/blobStore'

type PhotoTrayProps = {
  photos: Photo[]
  blobStore: BlobStore
  onImportFiles: (files: FileList | File[]) => void
}

export default function PhotoTray({
  photos,
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
        {photos.map((photo) => (
          <li
            key={photo.id}
            data-testid={`tray-photo-${photo.id}`}
            style={{
              border: '1px solid #d0d0d0',
              borderRadius: 4,
              overflow: 'hidden',
              aspectRatio: '1 / 1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
            }}
          >
            <Thumbnail photo={photo} blobStore={blobStore} />
          </li>
        ))}
      </ul>
    </section>
  )
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
