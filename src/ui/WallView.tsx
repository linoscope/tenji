import { useRef, useState } from 'react'
import type { Wall, Placement, Photo } from '../state/types'
import { cmToPx } from '../geometry/scale'
import { computeSizeFromLongEdge } from '../geometry/sizing'
import {
  computeAlignment,
  rectanglesOverlap,
  type AlignmentRect,
} from '../geometry/alignment'
import {
  computeRulerTicks,
  SILHOUETTE_HEIGHT_CM,
} from '../geometry/overlays'
import type { BlobStore } from '../storage/blobStore'
import PlacementView from './PlacementView'

type WallViewProps = {
  wall: Wall
  wallRef?: React.MutableRefObject<HTMLElement | null>
  scale: number
  placements: Placement[]
  photos: Photo[]
  blobStore: BlobStore
  selectedPlacementIds: string[]
  rulerEnabled: boolean
  silhouetteEnabled: boolean
  onSelectPlacement: (id: string) => void
  onToggleSelectPlacement: (id: string) => void
  onClearSelection: () => void
  onMovePlacement: (id: string, xCm: number, yCm: number) => void
  onMoveSelection: (dxCm: number, dyCm: number) => void
  onResizePlacement: (id: string, longEdgeCm: number) => void
}

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
  wallRef,
  scale,
  placements,
  photos,
  blobStore,
  selectedPlacementIds,
  rulerEnabled,
  silhouetteEnabled,
  onSelectPlacement,
  onToggleSelectPlacement,
  onClearSelection,
  onMovePlacement,
  onMoveSelection,
  onResizePlacement,
}: WallViewProps) {
  const selectedSet = new Set(selectedPlacementIds)
  const [liveDrag, setLiveDrag] = useState<LiveDrag | null>(null)
  /**
   * When a drag begins on a placement that is part of a multi-select, we drive
   * the whole group via moveSelection deltas and skip the snapping pipeline.
   * Otherwise we use the existing single-photo snap path.
   */
  const [groupDrag, setGroupDrag] = useState<{
    id: string
    startXCm: number
    startYCm: number
    lastDxCm: number
    lastDyCm: number
    /** True if mousedown was a plain click on an already-selected member of a 2+ selection. */
    collapseOnNoMove: boolean
  } | null>(null)
  /** Records the most recent click's shift state so onMoveStart can branch. */
  const lastClickShiftRef = useRef(false)

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

  // Group drag suppresses snapping/guides entirely (per spec).
  if (liveDrag && draggedPlacement && draggedPhoto && !groupDrag) {
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
      ref={(node) => {
        if (wallRef) wallRef.current = node
      }}
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
      {silhouetteEnabled ? (
        <SilhouetteOverlay wall={wall} scale={scale} />
      ) : null}
      {rulerEnabled ? <RulerOverlay wall={wall} scale={scale} /> : null}
      {placements.map((p) => {
        const photo = photos.find((ph) => ph.id === p.photoId)
        if (!photo) return null
        const isLive = liveDrag?.id === p.id
        const isSelected = selectedSet.has(p.id)
        // While a group drag is active, every selected placement renders at
        // its stored position + the live group delta so the whole set tracks
        // the cursor before we commit on mouseup.
        let renderXCm: number | undefined
        let renderYCm: number | undefined
        if (groupDrag && isSelected) {
          renderXCm = p.xCm + groupDrag.lastDxCm
          renderYCm = p.yCm + groupDrag.lastDyCm
        } else if (isLive && snappedXCm !== null && snappedYCm !== null) {
          renderXCm = snappedXCm
          renderYCm = snappedYCm
        }
        return (
          <PlacementView
            key={p.id}
            placement={p}
            photo={photo}
            scale={scale}
            blobStore={blobStore}
            selected={isSelected}
            // While 2+ are selected, drop the resize handles entirely.
            showHandles={isSelected && selectedSet.size <= 1}
            overlapping={overlappingIds.has(p.id)}
            renderXCm={renderXCm}
            renderYCm={renderYCm}
            onSelect={({ shiftKey }) => {
              lastClickShiftRef.current = shiftKey
              if (shiftKey) {
                onToggleSelectPlacement(p.id)
                return
              }
              // Plain mousedown on an unselected photo collapses the
              // selection to just it; on an already-selected photo we leave
              // the selection alone so a drag from a multi-select works as a
              // group drag. (A no-move click commits a collapse on mouseup —
              // see onMoveEnd below.)
              if (!isSelected) onSelectPlacement(p.id)
            }}
            onMoveStart={(id) => {
              // Group drag fires only on a plain (non-shift) click on a
              // placement that is already a member of a 2+ selection. Shift-
              // clicks and plain-clicks on unselected photos always fall
              // through to single-photo drag with the existing snap pipeline.
              const shiftKey = lastClickShiftRef.current
              const groupable =
                !shiftKey && isSelected && selectedSet.size >= 2
              if (groupable) {
                setGroupDrag({
                  id,
                  startXCm: p.xCm,
                  startYCm: p.yCm,
                  lastDxCm: 0,
                  lastDyCm: 0,
                  collapseOnNoMove: true,
                })
              } else {
                setLiveDrag({ id, rawXCm: p.xCm, rawYCm: p.yCm })
              }
            }}
            onMoveUpdate={(id, xCm, yCm) => {
              if (groupDrag && groupDrag.id === id) {
                setGroupDrag({
                  ...groupDrag,
                  lastDxCm: xCm - groupDrag.startXCm,
                  lastDyCm: yCm - groupDrag.startYCm,
                })
              } else {
                setLiveDrag({ id, rawXCm: xCm, rawYCm: yCm })
              }
            }}
            onMoveEnd={(id) => {
              if (groupDrag && groupDrag.id === id) {
                if (groupDrag.lastDxCm !== 0 || groupDrag.lastDyCm !== 0) {
                  onMoveSelection(groupDrag.lastDxCm, groupDrag.lastDyCm)
                } else if (groupDrag.collapseOnNoMove) {
                  // No-move plain click on a multi-selected photo collapses
                  // the selection to just it.
                  onSelectPlacement(id)
                }
                setGroupDrag(null)
                return
              }
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
      {liveDrag && !groupDrag ? (
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

const RULER_TICK_SPACING_CM = 50

function RulerOverlay({ wall, scale }: { wall: Wall; scale: number }) {
  const wallWidthPx = cmToPx(wall.widthCm, scale)
  const wallHeightPx = cmToPx(wall.heightCm, scale)
  const horizontalTicks = computeRulerTicks(wall.widthCm, RULER_TICK_SPACING_CM)
  const verticalTicks = computeRulerTicks(wall.heightCm, RULER_TICK_SPACING_CM)
  return (
    <div
      data-testid="overlay-ruler"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        color: '#666',
        fontSize: 10,
      }}
    >
      {horizontalTicks.map((cm) => (
        <div
          key={`h-${cm}`}
          data-tick-axis="horizontal"
          data-tick-cm={cm}
          style={{
            position: 'absolute',
            left: cmToPx(cm, scale),
            top: 0,
            width: 0,
            height: wallHeightPx,
            borderLeft:
              cm === 0 || cm === wall.widthCm
                ? '1px solid rgba(0,0,0,0.25)'
                : '1px solid rgba(0,0,0,0.08)',
          }}
        />
      ))}
      {verticalTicks.map((cm) => (
        <div
          key={`v-${cm}`}
          data-tick-axis="vertical"
          data-tick-cm={cm}
          style={{
            position: 'absolute',
            top: cmToPx(cm, scale),
            left: 0,
            height: 0,
            width: wallWidthPx,
            borderTop:
              cm === 0 || cm === wall.heightCm
                ? '1px solid rgba(0,0,0,0.25)'
                : '1px solid rgba(0,0,0,0.08)',
          }}
        />
      ))}
      {horizontalTicks.map((cm) => (
        <div
          key={`hl-${cm}`}
          style={{
            position: 'absolute',
            left: cmToPx(cm, scale),
            top: -14,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
          }}
        >
          {cm}
        </div>
      ))}
      {verticalTicks.map((cm) => (
        <div
          key={`vl-${cm}`}
          style={{
            position: 'absolute',
            top: cmToPx(cm, scale),
            left: -4,
            transform: 'translate(-100%, -50%)',
            whiteSpace: 'nowrap',
          }}
        >
          {cm}
        </div>
      ))}
    </div>
  )
}

function SilhouetteOverlay({ wall, scale }: { wall: Wall; scale: number }) {
  const wallWidthPx = cmToPx(wall.widthCm, scale)
  const wallHeightPx = cmToPx(wall.heightCm, scale)
  const silhouetteHeightPx = cmToPx(SILHOUETTE_HEIGHT_CM, scale)
  // Roughly average shoulder-to-shoulder over height ratio; just for scale.
  const silhouetteWidthPx = silhouetteHeightPx * 0.25
  // Park the figure in the right third of the wall, feet on the floor line.
  const leftPx = wallWidthPx * 0.7
  return (
    <>
      <div
        data-testid="overlay-floor"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: wallHeightPx,
          height: 0,
          borderTop: '1px dashed rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}
      />
      <div
        data-testid="overlay-silhouette"
        data-height-cm={SILHOUETTE_HEIGHT_CM}
        style={{
          position: 'absolute',
          left: leftPx,
          top: wallHeightPx - silhouetteHeightPx,
          width: silhouetteWidthPx,
          height: silhouetteHeightPx,
          pointerEvents: 'none',
          opacity: 0.18,
        }}
      >
        <svg
          viewBox="0 0 20 100"
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          aria-hidden
        >
          {/* Head */}
          <circle cx="10" cy="9" r="6" fill="#000" />
          {/* Body (shoulders → hips → legs, single silhouette path) */}
          <path
            d="M3 22 Q3 18 6 17 L14 17 Q17 18 17 22 L15 55 L13 100 L11 100 L10 65 L9 100 L7 100 L5 55 Z"
            fill="#000"
          />
        </svg>
      </div>
    </>
  )
}
