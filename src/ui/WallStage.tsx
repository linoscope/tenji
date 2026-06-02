import { useEffect, useRef, useState } from 'react'
import type { Wall, Placement, Photo } from '../state/types'
import type { BlobStore } from '../storage/blobStore'
import { computeFitScale } from '../geometry/scale'
import { computeSizeFromLongEdge } from '../geometry/sizing'
import {
  computeMarqueeHits,
  normalizeMarqueeRect,
  type MarqueeRect,
} from '../geometry/marquee'
import type { AlignmentRect } from '../geometry/alignment'
import WallView from './WallView'

const MARGIN_PX = 48
/** Threshold (px) below which a click is treated as a click, not a marquee. */
const MARQUEE_THRESHOLD_PX = 4

type WallStageProps = {
  wall: Wall
  /** Forwarded to the wall <div> so the parent can capture it for export. */
  wallRef?: React.MutableRefObject<HTMLElement | null>
  placements: Placement[]
  photos: Photo[]
  blobStore: BlobStore
  selectedPlacementIds: string[]
  rulerEnabled: boolean
  silhouetteEnabled: boolean
  onSelectPlacement: (id: string) => void
  onToggleSelectPlacement: (id: string) => void
  onClearSelection: () => void
  onSetSelection: (ids: string[]) => void
  onMovePlacement: (id: string, xCm: number, yCm: number) => void
  onMoveSelection: (dxCm: number, dyCm: number) => void
  onResizePlacement: (id: string, longEdgeCm: number) => void
}

type MarqueeDrag = {
  /** Pointer coords at mousedown, in client px. */
  startClientX: number
  startClientY: number
  /** Current pointer coords in client px. */
  lastClientX: number
  lastClientY: number
  /** True once movement exceeded the threshold — i.e. we're really marquee-ing. */
  active: boolean
  shiftKey: boolean
  /** Snapshot of the selection at gesture start (for shift-union). */
  initialSelection: string[]
}

/** Build the AlignmentRect for each placement on the active wall. */
function buildPlacementRects(
  placements: Placement[],
  photos: Photo[],
): AlignmentRect[] {
  const rects: AlignmentRect[] = []
  for (const p of placements) {
    const photo = photos.find((ph) => ph.id === p.photoId)
    if (!photo) continue
    const size = computeSizeFromLongEdge(p.longEdgeCm, photo.aspectRatio)
    rects.push({
      id: p.id,
      centerXCm: p.xCm,
      centerYCm: p.yCm,
      widthCm: size.widthCm,
      heightCm: size.heightCm,
    })
  }
  return rects
}

/**
 * Measures its own box and renders the wall fit-to-screen inside it, so the
 * whole wall is always visible with margin around it for parking.
 */
export default function WallStage({
  wall,
  wallRef,
  placements,
  photos,
  blobStore,
  selectedPlacementIds,
  rulerEnabled,
  silhouetteEnabled,
  onSelectPlacement,
  onToggleSelectPlacement,
  onClearSelection,
  onSetSelection,
  onMovePlacement,
  onMoveSelection,
  onResizePlacement,
}: WallStageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const internalWallRef = useRef<HTMLElement | null>(null)
  const wallRefForward: React.MutableRefObject<HTMLElement | null> = {
    get current() {
      return internalWallRef.current
    },
    set current(v: HTMLElement | null) {
      internalWallRef.current = v
      if (wallRef) wallRef.current = v
    },
  }

  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) setViewport({ width: w, height: h })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scale = computeFitScale({
    wallWidthCm: wall.widthCm,
    wallHeightCm: wall.heightCm,
    viewportWidthPx: viewport.width,
    viewportHeightPx: viewport.height,
    marginPx: MARGIN_PX,
  })
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 0

  // Marquee state. drag !== null while the user is potentially marqueeing;
  // drag.active === true once we've crossed the movement threshold.
  const [drag, setDrag] = useState<MarqueeDrag | null>(null)
  const dragRef = useRef<MarqueeDrag | null>(null)
  dragRef.current = drag

  // Use a stable ref to placements/photos/initialSelection so the global
  // mouse listeners don't have to remount on every re-render.
  const placementsRef = useRef(placements)
  placementsRef.current = placements
  const photosRef = useRef(photos)
  photosRef.current = photos
  const selectedRef = useRef(selectedPlacementIds)
  selectedRef.current = selectedPlacementIds

  /**
   * Convert client px to wall-relative cm using the wall element's bounding
   * rect. We derive scale from the rendered rect (rather than the computed fit
   * scale) so the conversion stays valid even if layout differs from the
   * theoretical fit (e.g. in jsdom tests that stub getBoundingClientRect).
   */
  const clientToWallCm = (clientX: number, clientY: number) => {
    const wallEl = internalWallRef.current
    if (!wallEl) return { xCm: 0, yCm: 0 }
    const rect = wallEl.getBoundingClientRect()
    if (rect.width <= 0) return { xCm: 0, yCm: 0 }
    const pxPerCm = rect.width / wall.widthCm
    return {
      xCm: (clientX - rect.left) / pxPerCm,
      yCm: (clientY - rect.top) / pxPerCm,
    }
  }

  // While a marquee is in progress, listen on window so we don't lose the
  // gesture if the cursor leaves the stage.
  useEffect(() => {
    if (!drag) return
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startClientX
      const dy = e.clientY - d.startClientY
      const next: MarqueeDrag = {
        ...d,
        lastClientX: e.clientX,
        lastClientY: e.clientY,
        active: d.active || Math.hypot(dx, dy) >= MARQUEE_THRESHOLD_PX,
      }
      dragRef.current = next
      setDrag(next)
    }
    const onUp = (e: MouseEvent) => {
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!d) return
      const dx = e.clientX - d.startClientX
      const dy = e.clientY - d.startClientY
      const moved =
        d.active || Math.hypot(dx, dy) >= MARQUEE_THRESHOLD_PX
      if (!moved) {
        // Sub-threshold click on empty stage → clear (today's behavior).
        if (!d.shiftKey) onClearSelection()
        return
      }
      // Compute hits using a normalized cm rect.
      const a = clientToWallCm(d.startClientX, d.startClientY)
      const b = clientToWallCm(e.clientX, e.clientY)
      const marquee = normalizeMarqueeRect({
        x1Cm: a.xCm,
        y1Cm: a.yCm,
        x2Cm: b.xCm,
        y2Cm: b.yCm,
      })
      const rects = buildPlacementRects(placementsRef.current, photosRef.current)
      const hits = computeMarqueeHits({ marquee, placements: rects })
      if (d.shiftKey) {
        if (hits.length === 0) return
        onSetSelection([...d.initialSelection, ...hits])
      } else {
        onSetSelection(hits)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  const onStageMouseDown = (e: React.MouseEvent) => {
    // Marquee only starts on a click of empty stage background, never on a
    // child (a placement or the wall itself — wall clicks fall through to
    // WallView's onClearSelection handler).
    if (e.target !== e.currentTarget) return
    if (e.button !== 0) return
    const next: MarqueeDrag = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      active: false,
      shiftKey: e.shiftKey,
      initialSelection: selectedRef.current,
    }
    dragRef.current = next
    setDrag(next)
  }

  // Compute the live marquee overlay rect in client px relative to the stage.
  let marqueeBox: { leftPx: number; topPx: number; widthPx: number; heightPx: number } | null =
    null
  if (drag && drag.active && ref.current) {
    const stageRect = ref.current.getBoundingClientRect()
    const left = Math.min(drag.startClientX, drag.lastClientX) - stageRect.left
    const top = Math.min(drag.startClientY, drag.lastClientY) - stageRect.top
    const width = Math.abs(drag.lastClientX - drag.startClientX)
    const height = Math.abs(drag.lastClientY - drag.startClientY)
    marqueeBox = { leftPx: left, topPx: top, widthPx: width, heightPx: height }
  }

  // While dragging, compute which placements are currently covered (for a
  // live highlight in WallView). Selection itself is only committed on up.
  let liveCoveredIds: string[] = selectedPlacementIds
  if (drag && drag.active && safeScale > 0) {
    const a = clientToWallCm(drag.startClientX, drag.startClientY)
    const b = clientToWallCm(drag.lastClientX, drag.lastClientY)
    const marquee: MarqueeRect = normalizeMarqueeRect({
      x1Cm: a.xCm,
      y1Cm: a.yCm,
      x2Cm: b.xCm,
      y2Cm: b.yCm,
    })
    const rects = buildPlacementRects(placements, photos)
    const hits = computeMarqueeHits({ marquee, placements: rects })
    if (drag.shiftKey) {
      const set = new Set(drag.initialSelection)
      for (const id of hits) set.add(id)
      liveCoveredIds = Array.from(set)
    } else {
      liveCoveredIds = hits
    }
  }

  return (
    <div
      ref={ref}
      data-testid="stage"
      onMouseDown={onStageMouseDown}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e9e9ec',
        overflow: 'hidden',
        position: 'relative',
        userSelect: drag?.active ? 'none' : undefined,
      }}
    >
      <WallView
        wall={wall}
        wallRef={wallRefForward}
        scale={safeScale}
        placements={placements}
        photos={photos}
        blobStore={blobStore}
        selectedPlacementIds={liveCoveredIds}
        rulerEnabled={rulerEnabled}
        silhouetteEnabled={silhouetteEnabled}
        onSelectPlacement={onSelectPlacement}
        onToggleSelectPlacement={onToggleSelectPlacement}
        onClearSelection={onClearSelection}
        onMovePlacement={onMovePlacement}
        onMoveSelection={onMoveSelection}
        onResizePlacement={onResizePlacement}
      />
      {marqueeBox ? (
        <div
          data-testid="marquee"
          style={{
            position: 'absolute',
            left: marqueeBox.leftPx,
            top: marqueeBox.topPx,
            width: marqueeBox.widthPx,
            height: marqueeBox.heightPx,
            border: '1px solid rgba(42, 109, 244, 0.8)',
            background: 'rgba(42, 109, 244, 0.12)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  )
}
