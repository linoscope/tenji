import { useEffect, useRef, useState } from 'react'
import type { Wall, Placement, Photo } from '../state/types'
import type { BlobStore } from '../storage/blobStore'
import { computeFitScale } from '../geometry/scale'
import WallView from './WallView'

const MARGIN_PX = 48

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
  onDropPhoto: (input: { photoId: string; xCm: number; yCm: number }) => void
  onSelectPlacement: (id: string) => void
  onToggleSelectPlacement: (id: string) => void
  onClearSelection: () => void
  onMovePlacement: (id: string, xCm: number, yCm: number) => void
  onMoveSelection: (dxCm: number, dyCm: number) => void
  onResizePlacement: (id: string, longEdgeCm: number) => void
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
  onDropPhoto,
  onSelectPlacement,
  onToggleSelectPlacement,
  onClearSelection,
  onMovePlacement,
  onMoveSelection,
  onResizePlacement,
}: WallStageProps) {
  const ref = useRef<HTMLDivElement>(null)
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

  return (
    <div
      ref={ref}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e9e9ec',
        overflow: 'hidden',
      }}
    >
      <WallView
        wall={wall}
        wallRef={wallRef}
        scale={Number.isFinite(scale) ? scale : 0}
        placements={placements}
        photos={photos}
        blobStore={blobStore}
        selectedPlacementIds={selectedPlacementIds}
        rulerEnabled={rulerEnabled}
        silhouetteEnabled={silhouetteEnabled}
        onDropPhoto={onDropPhoto}
        onSelectPlacement={onSelectPlacement}
        onToggleSelectPlacement={onToggleSelectPlacement}
        onClearSelection={onClearSelection}
        onMovePlacement={onMovePlacement}
        onMoveSelection={onMoveSelection}
        onResizePlacement={onResizePlacement}
      />
    </div>
  )
}
