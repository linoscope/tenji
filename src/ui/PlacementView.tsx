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
  /**
   * Defaults to `selected`. Pass `false` when this placement is selected as
   * part of a multi-select group, so the corner resize handles don't render.
   */
  showHandles?: boolean
  /** Visual flag when this placement overlaps another. */
  overlapping?: boolean
  /**
   * Center in cm to render at. Defaults to the placement's stored x/y; the
   * parent overrides this with the snapped position while dragging.
   */
  renderXCm?: number
  renderYCm?: number
  /** Fires on mousedown of the body. shiftKey signals additive multi-select. */
  onSelect: (opts: { shiftKey: boolean }) => void
  /** Fires on mousedown so the parent can register the active drag. */
  onMoveStart?: (id: string) => void
  /** Fires on every mousemove with the raw (un-snapped) cursor position in cm. */
  onMoveUpdate?: (id: string, xCm: number, yCm: number) => void
  /** Fires once on mouseup, with whatever final cm the parent wants committed. */
  onMoveEnd?: (id: string) => void
  /** Fallback for tests that don't use the parent-driven snap pipeline. */
  onMove: (xCm: number, yCm: number) => void
  onResize: (longEdgeCm: number) => void
}

type Corner = 'nw' | 'ne' | 'sw' | 'se'
const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']
const MIN_LONG_EDGE_CM = 1
const HANDLE_SIZE_PX = 10

export default function PlacementView({
  placement,
  photo,
  scale,
  blobStore,
  selected,
  showHandles,
  overlapping = false,
  renderXCm,
  renderYCm,
  onSelect,
  onMoveStart,
  onMoveUpdate,
  onMoveEnd,
  onMove,
  onResize,
}: PlacementViewProps) {
  // While resizing, render the in-progress long edge so the photo + handles
  // track the cursor live; commit to state on mouse up.
  const [liveLongEdgeCm, setLiveLongEdgeCm] = useState<number | null>(null)
  const liveLongEdgeRef = useRef<number | null>(null)
  useEffect(() => {
    liveLongEdgeRef.current = liveLongEdgeCm
  }, [liveLongEdgeCm])

  const effectiveLongEdgeCm = liveLongEdgeCm ?? placement.longEdgeCm
  const size = computeSizeFromLongEdge(effectiveLongEdgeCm, photo.aspectRatio)
  const widthPx = cmToPx(size.widthCm, scale)
  const heightPx = cmToPx(size.heightCm, scale)

  // Move-drag.
  const [dragging, setDragging] = useState(false)
  const dragStateRef = useRef<{
    startClientX: number
    startClientY: number
    startXCm: number
    startYCm: number
    lastRawXCm: number
    lastRawYCm: number
  } | null>(null)

  useEffect(() => {
    if (!dragging) return
    const onMove_ = (e: MouseEvent) => {
      const s = dragStateRef.current
      if (!s) return
      const dxCm = (e.clientX - s.startClientX) / scale
      const dyCm = (e.clientY - s.startClientY) / scale
      const rawXCm = s.startXCm + dxCm
      const rawYCm = s.startYCm + dyCm
      s.lastRawXCm = rawXCm
      s.lastRawYCm = rawYCm
      if (onMoveUpdate) {
        onMoveUpdate(placement.id, rawXCm, rawYCm)
      }
    }
    const onUp = () => {
      const s = dragStateRef.current
      dragStateRef.current = null
      setDragging(false)
      if (!s) return
      if (onMoveEnd) {
        onMoveEnd(placement.id)
      } else if (s.lastRawXCm !== s.startXCm || s.lastRawYCm !== s.startYCm) {
        // Legacy path used by tests that don't wire the snap pipeline.
        onMove(s.lastRawXCm, s.lastRawYCm)
      }
    }
    window.addEventListener('mousemove', onMove_)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove_)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, scale, onMove, onMoveUpdate, onMoveEnd, placement.id])

  // Resize-drag.
  const resizeRef = useRef<{
    centerClientX: number
    centerClientY: number
    startDistPx: number
    startLongEdgeCm: number
  } | null>(null)
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    if (!resizing) return
    const onMove_ = (e: MouseEvent) => {
      const r = resizeRef.current
      if (!r) return
      const distNow = Math.hypot(
        e.clientX - r.centerClientX,
        e.clientY - r.centerClientY,
      )
      const ratio = distNow / r.startDistPx
      const next = Math.max(MIN_LONG_EDGE_CM, r.startLongEdgeCm * ratio)
      setLiveLongEdgeCm(next)
    }
    const onUp = () => {
      const live = liveLongEdgeRef.current
      const start = resizeRef.current?.startLongEdgeCm
      resizeRef.current = null
      setResizing(false)
      setLiveLongEdgeCm(null)
      if (live !== null && start !== undefined && live !== start) {
        onResize(live)
      }
    }
    window.addEventListener('mousemove', onMove_)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove_)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing, onResize])

  const beginResize = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const placementEl = (e.currentTarget as HTMLElement).parentElement
    if (!placementEl) return
    const rect = placementEl.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startDistPx = Math.hypot(e.clientX - centerX, e.clientY - centerY)
    if (startDistPx === 0) return
    resizeRef.current = {
      centerClientX: centerX,
      centerClientY: centerY,
      startDistPx,
      startLongEdgeCm: placement.longEdgeCm,
    }
    setLiveLongEdgeCm(placement.longEdgeCm)
    setResizing(true)
  }

  const onMouseDownBody = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect({ shiftKey: e.shiftKey || e.metaKey })
    dragStateRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startXCm: placement.xCm,
      startYCm: placement.yCm,
      lastRawXCm: placement.xCm,
      lastRawYCm: placement.yCm,
    }
    setDragging(true)
    if (onMoveStart) onMoveStart(placement.id)
  }

  const xCm = renderXCm ?? placement.xCm
  const yCm = renderYCm ?? placement.yCm
  const centerXPx = cmToPx(xCm, scale)
  const centerYPx = cmToPx(yCm, scale)
  const leftPx = centerXPx - widthPx / 2
  const topPx = centerYPx - heightPx / 2

  const outline = overlapping
    ? '2px solid #d23a3a'
    : selected
      ? '2px solid #2a6df4'
      : '1px solid #888'

  return (
    <div
      data-testid={`placement-${placement.id}`}
      data-photo-id={photo.id}
      data-long-edge-cm={placement.longEdgeCm}
      data-x-cm={placement.xCm}
      data-y-cm={placement.yCm}
      data-orientation={size.orientation}
      data-selected={selected ? 'true' : 'false'}
      data-overlapping={overlapping ? 'true' : 'false'}
      onMouseDown={onMouseDownBody}
      style={{
        position: 'absolute',
        left: leftPx,
        top: topPx,
        width: widthPx,
        height: heightPx,
        outline,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        background: '#fff',
      }}
    >
      <Thumbnail photo={photo} blobStore={blobStore} />
      {(showHandles ?? selected)
        ? CORNERS.map((corner) => (
            <span
              key={corner}
              data-resize-handle={corner}
              onMouseDown={beginResize}
              style={cornerStyle(corner)}
            />
          ))
        : null}
    </div>
  )
}

function cornerStyle(corner: Corner): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: HANDLE_SIZE_PX,
    height: HANDLE_SIZE_PX,
    background: '#fff',
    border: '1.5px solid #2a6df4',
    boxSizing: 'border-box',
    borderRadius: 2,
  }
  const offset = -HANDLE_SIZE_PX / 2
  switch (corner) {
    case 'nw':
      return { ...base, left: offset, top: offset, cursor: 'nwse-resize' }
    case 'ne':
      return { ...base, right: offset, top: offset, cursor: 'nesw-resize' }
    case 'sw':
      return { ...base, left: offset, bottom: offset, cursor: 'nesw-resize' }
    case 'se':
      return { ...base, right: offset, bottom: offset, cursor: 'nwse-resize' }
  }
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
