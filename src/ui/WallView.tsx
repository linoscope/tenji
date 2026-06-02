import type { Wall, Placement, Photo } from '../state/types'
import { cmToPx } from '../geometry/scale'
import type { BlobStore } from '../storage/blobStore'
import PlacementView from './PlacementView'

type WallViewProps = {
  wall: Wall
  scale: number
  placements: Placement[]
  photos: Photo[]
  blobStore: BlobStore
  selectedPlacementId: string | null
  onDropPhoto: (input: { photoId: string; xCm: number; yCm: number }) => void
  onSelectPlacement: (id: string) => void
  onClearSelection: () => void
  onMovePlacement: (id: string, xCm: number, yCm: number) => void
}

const PHOTO_MIME = 'application/x-tenji-photo'

/** The wall itself, drawn to scale on a plain white background. */
export default function WallView({
  wall,
  scale,
  placements,
  photos,
  blobStore,
  selectedPlacementId,
  onDropPhoto,
  onSelectPlacement,
  onClearSelection,
  onMovePlacement,
}: WallViewProps) {
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes(PHOTO_MIME)) {
      e.preventDefault()
    }
  }
  const onDrop = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes(PHOTO_MIME)) return
    e.preventDefault()
    e.stopPropagation()
    const photoId = e.dataTransfer.getData(PHOTO_MIME)
    if (!photoId || scale <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xCm = (e.clientX - rect.left) / scale
    const yCm = (e.clientY - rect.top) / scale
    onDropPhoto({ photoId, xCm, yCm })
  }

  const onWallMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClearSelection()
  }

  return (
    <div
      data-testid="wall"
      data-width-cm={wall.widthCm}
      data-height-cm={wall.heightCm}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseDown={onWallMouseDown}
      style={{
        position: 'relative',
        width: cmToPx(wall.widthCm, scale),
        height: cmToPx(wall.heightCm, scale),
        background: '#ffffff',
        boxShadow: '0 1px 8px rgba(0,0,0,0.15)',
        border: '1px solid #d0d0d0',
      }}
    >
      {placements.map((p) => {
        const photo = photos.find((ph) => ph.id === p.photoId)
        if (!photo) return null
        return (
          <PlacementView
            key={p.id}
            placement={p}
            photo={photo}
            scale={scale}
            blobStore={blobStore}
            selected={p.id === selectedPlacementId}
            onSelect={() => onSelectPlacement(p.id)}
            onMove={(xCm, yCm) => onMovePlacement(p.id, xCm, yCm)}
          />
        )
      })}
    </div>
  )
}
