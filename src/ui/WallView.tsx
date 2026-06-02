import { useState } from 'react'
import type { Wall, Placement, Photo } from '../state/types'
import { cmToPx } from '../geometry/scale'
import { computeSizeFromLongEdge } from '../geometry/sizing'
import {
  computeAlignment,
  rectanglesOverlap,
  type AlignmentRect,
} from '../geometry/alignment'
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
  onResizePlacement: (id: string, longEdgeCm: number) => void
}

const PHOTO_MIME = 'application/x-tenji-photo'
const SNAP_TOLERANCE_CM = 1

type LiveDrag = {
  id: string
  rawXCm: number
  rawYCm: number
}

/** Build the alignment-geometry view of a placement at a given center. */
function placementToRect(
  p: Placement,
  photo: Photo,
  centerXCm: number,
  centerYCm: number,
): AlignmentRect {
  const size = computeSizeFromLongEdge(p.longEdgeCm, photo.aspectRatio)
  return {
    id: p.id,
    centerXCm,
    centerYCm,
    widthCm: size.widthCm,
    heightCm: size.heightCm,
  }
}

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
  onResizePlacement,
}: WallViewProps) {
  const [liveDrag, setLiveDrag] = useState<LiveDrag | null>(null)

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

  // Compute alignment for the active drag, if any.
  const draggedPlacement = liveDrag
    ? placements.find((p) => p.id === liveDrag.id)
    : null
  const draggedPhoto = draggedPlacement
    ? photos.find((ph) => ph.id === draggedPlacement.photoId)
    : null

  let snappedXCm: number | null = null
  let snappedYCm: number | null = null
  let guides: ReturnType<typeof computeAlignment>['guides'] = []
  let gaps: ReturnType<typeof computeAlignment>['gaps'] = []
  const overlappingIds = new Set<string>()

  if (liveDrag && draggedPlacement && draggedPhoto) {
    const draggedRect = placementToRect(
      draggedPlacement,
      draggedPhoto,
      liveDrag.rawXCm,
      liveDrag.rawYCm,
    )
    const others: AlignmentRect[] = placements
      .filter((p) => p.id !== liveDrag.id)
      .map((p) => {
        const photo = photos.find((ph) => ph.id === p.photoId)
        if (!photo) return null
        return placementToRect(p, photo, p.xCm, p.yCm)
      })
      .filter((r): r is AlignmentRect => r !== null)

    const alignment = computeAlignment({
      dragged: draggedRect,
      others,
      wall: { widthCm: wall.widthCm, heightCm: wall.heightCm },
      toleranceCm: SNAP_TOLERANCE_CM,
    })
    snappedXCm = alignment.snappedCenterXCm
    snappedYCm = alignment.snappedCenterYCm
    guides = alignment.guides
    gaps = alignment.gaps

    const snappedDraggedRect: AlignmentRect = {
      ...draggedRect,
      centerXCm: snappedXCm,
      centerYCm: snappedYCm,
    }
    for (const o of others) {
      if (rectanglesOverlap(snappedDraggedRect, o)) {
        overlappingIds.add(o.id)
        overlappingIds.add(liveDrag.id)
      }
    }
  } else {
    // Static overlap check (without an active drag), so placements that
    // were committed overlapping still flag.
    const rects: AlignmentRect[] = placements
      .map((p) => {
        const photo = photos.find((ph) => ph.id === p.photoId)
        if (!photo) return null
        return placementToRect(p, photo, p.xCm, p.yCm)
      })
      .filter((r): r is AlignmentRect => r !== null)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (rectanglesOverlap(rects[i], rects[j])) {
          overlappingIds.add(rects[i].id)
          overlappingIds.add(rects[j].id)
        }
      }
    }
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
        const isLive = liveDrag?.id === p.id
        return (
          <PlacementView
            key={p.id}
            placement={p}
            photo={photo}
            scale={scale}
            blobStore={blobStore}
            selected={p.id === selectedPlacementId}
            overlapping={overlappingIds.has(p.id)}
            renderXCm={isLive && snappedXCm !== null ? snappedXCm : undefined}
            renderYCm={isLive && snappedYCm !== null ? snappedYCm : undefined}
            onSelect={() => onSelectPlacement(p.id)}
            onMoveStart={(id) => {
              setLiveDrag({ id, rawXCm: p.xCm, rawYCm: p.yCm })
            }}
            onMoveUpdate={(id, xCm, yCm) => {
              setLiveDrag({ id, rawXCm: xCm, rawYCm: yCm })
            }}
            onMoveEnd={(id) => {
              if (snappedXCm !== null && snappedYCm !== null) {
                if (snappedXCm !== p.xCm || snappedYCm !== p.yCm) {
                  onMovePlacement(id, snappedXCm, snappedYCm)
                }
              }
              setLiveDrag(null)
            }}
            onMove={(xCm, yCm) => onMovePlacement(p.id, xCm, yCm)}
            onResize={(longEdgeCm) => onResizePlacement(p.id, longEdgeCm)}
          />
        )
      })}
      {liveDrag ? (
        <GuideOverlay
          guides={guides}
          gaps={gaps}
          wall={wall}
          scale={scale}
        />
      ) : null}
    </div>
  )
}

type GuideOverlayProps = {
  guides: ReturnType<typeof computeAlignment>['guides']
  gaps: ReturnType<typeof computeAlignment>['gaps']
  wall: Wall
  scale: number
}

function GuideOverlay({ guides, gaps, wall, scale }: GuideOverlayProps) {
  const wallWidthPx = cmToPx(wall.widthCm, scale)
  const wallHeightPx = cmToPx(wall.heightCm, scale)
  return (
    <>
      {guides.map((g, i) => {
        const isVertical =
          g.kind === 'wall-center-vertical' ||
          g.kind === 'wall-edge-vertical' ||
          g.kind === 'sibling-center-vertical' ||
          g.kind === 'sibling-edge-vertical'
        const atPx = cmToPx(g.atCm, scale)
        const color = g.kind.startsWith('wall-') ? '#ff2d8f' : '#1ec8a5'
        const style: React.CSSProperties = isVertical
          ? {
              position: 'absolute',
              left: atPx,
              top: 0,
              width: 0,
              height: wallHeightPx,
              borderLeft: `1px dashed ${color}`,
              pointerEvents: 'none',
            }
          : {
              position: 'absolute',
              left: 0,
              top: atPx,
              width: wallWidthPx,
              height: 0,
              borderTop: `1px dashed ${color}`,
              pointerEvents: 'none',
            }
        return (
          <div
            key={`${g.kind}-${g.atCm}-${i}`}
            data-testid={`guide-${g.kind}`}
            data-at-cm={g.atCm}
            style={style}
          />
        )
      })}
      {gaps.map((gap, i) => (
        <div
          key={`gap-${gap.otherId}-${i}`}
          data-testid={`gap-${gap.otherId}`}
          data-gap-cm={gap.gapCm}
          data-axis={gap.axis}
          style={{
            position: 'absolute',
            left: cmToPx(gap.midXCm, scale),
            top: cmToPx(gap.midYCm, scale),
            transform: 'translate(-50%, -50%)',
            background: '#222',
            color: '#fff',
            fontSize: 10,
            padding: '1px 4px',
            borderRadius: 2,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {Math.round(gap.gapCm)} cm
        </div>
      ))}
    </>
  )
}
