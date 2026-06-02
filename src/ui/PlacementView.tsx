import { useEffect, useRef, useState } from 'react'
import type { Photo, Placement } from '../state/types'
import type { BlobStore } from '../storage/blobStore'
import { cmToPx } from '../geometry/scale'
import { computeSizeFromLongEdge } from '../geometry/sizing'

type PlacementViewProps = {
  placement: Placement
  photo: Photo
  scale: number
  blobStore: BlobStore
  selected: boolean
  onSelect: () => void
  onMove: (xCm: number, yCm: number) => void
}

export default function PlacementView({
  placement,
  photo,
  scale,
  blobStore,
  selected,
  onSelect,
  onMove,
}: PlacementViewProps) {
  const size = computeSizeFromLongEdge(placement.longEdgeCm, photo.aspectRatio)
  const widthPx = cmToPx(size.widthCm, scale)
  const heightPx = cmToPx(size.heightCm, scale)

  // Drag state (in px relative to the wall is what we track via cm).
  const [dragOffsetPx, setDragOffsetPx] = useState<{ x: number; y: number } | null>(
    null,
  )
  const dragStateRef = useRef<{
    startClientX: number
    startClientY: number
    startXCm: number
    startYCm: number
  } | null>(null)

  useEffect(() => {
    if (!dragOffsetPx) return
    const onMove_ = (e: MouseEvent) => {
      const s = dragStateRef.current
      if (!s) return
      setDragOffsetPx({
        x: e.clientX - s.startClientX,
        y: e.clientY - s.startClientY,
      })
    }
    const onUp = (e: MouseEvent) => {
      const s = dragStateRef.current
      if (!s) return
      const dxCm = (e.clientX - s.startClientX) / scale
      const dyCm = (e.clientY - s.startClientY) / scale
      setDragOffsetPx(null)
      dragStateRef.current = null
      if (dxCm !== 0 || dyCm !== 0) {
        onMove(s.startXCm + dxCm, s.startYCm + dyCm)
      }
    }
    window.addEventListener('mousemove', onMove_)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove_)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragOffsetPx, scale, onMove])

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
    dragStateRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startXCm: placement.xCm,
      startYCm: placement.yCm,
    }
    setDragOffsetPx({ x: 0, y: 0 })
  }

  // Convert center-in-cm → top-left-in-px within the wall.
  const centerXPx = cmToPx(placement.xCm, scale) + (dragOffsetPx?.x ?? 0)
  const centerYPx = cmToPx(placement.yCm, scale) + (dragOffsetPx?.y ?? 0)
  const leftPx = centerXPx - widthPx / 2
  const topPx = centerYPx - heightPx / 2

  return (
    <div
      data-testid={`placement-${placement.id}`}
      data-photo-id={photo.id}
      data-long-edge-cm={placement.longEdgeCm}
      data-x-cm={placement.xCm}
      data-y-cm={placement.yCm}
      data-orientation={size.orientation}
      data-selected={selected ? 'true' : 'false'}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: leftPx,
        top: topPx,
        width: widthPx,
        height: heightPx,
        outline: selected ? '2px solid #2a6df4' : '1px solid #888',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        cursor: dragOffsetPx ? 'grabbing' : 'grab',
        userSelect: 'none',
        background: '#fff',
      }}
    >
      <Thumbnail photo={photo} blobStore={blobStore} />
    </div>
  )
}

function Thumbnail({ photo, blobStore }: { photo: Photo; blobStore: BlobStore }) {
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
  if (!url) return null
  return (
    <img
      src={url}
      alt={photo.filename}
      draggable={false}
      style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
    />
  )
}
