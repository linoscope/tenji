import type { Photo, Placement, PlacementSize } from '../state/types'
import {
  A_SERIES_PRESETS,
  resolvePlacementSize,
  resolveSizeLabel,
  computeSizeFromLongEdge,
} from '../geometry/sizing'

type PlacementInspectorProps = {
  placement: Placement
  photo: Photo
  onSetSize: (size: PlacementSize) => void
  onSwapCropOrientation: () => void
  /** Removes this placement instance only. The photo metadata is preserved. */
  onDelete: () => void
}

const ROUND = (n: number) => Math.round(n * 10) / 10

/** Return a preset's W×H rectangle with orientation following the photo. */
function presetCropRect(
  longEdgeCm: number,
  aspectRatio: number,
): { widthCm: number; heightCm: number } {
  const s = computeSizeFromLongEdge(longEdgeCm, aspectRatio)
  return { widthCm: s.widthCm, heightCm: s.heightCm }
}

export default function PlacementInspector({
  placement,
  photo,
  onSetSize,
  onSwapCropOrientation,
  onDelete,
}: PlacementInspectorProps) {
  const mode = placement.size.mode
  const resolved = resolvePlacementSize(placement.size, photo.aspectRatio)
  const label =
    mode === 'aspect'
      ? resolveSizeLabel(placement.size.longEdgeCm)
      : presetLabelForCrop(placement.size.widthCm, placement.size.heightCm)

  const onAspectClick = () => {
    if (mode === 'aspect') return
    // Switch to aspect mode using the placement's current long edge.
    const longEdgeCm = Math.max(placement.size.widthCm, placement.size.heightCm)
    onSetSize({ mode: 'aspect', longEdgeCm })
  }
  const onCropClick = () => {
    if (mode === 'crop') return
    // Switch to crop mode by promoting the current resolved rectangle.
    onSetSize({
      mode: 'crop',
      widthCm: resolved.widthCm,
      heightCm: resolved.heightCm,
    })
  }

  const applyPreset = (longEdgeCm: number) => {
    if (mode === 'aspect') {
      onSetSize({ mode: 'aspect', longEdgeCm })
    } else {
      const rect = presetCropRect(longEdgeCm, photo.aspectRatio)
      onSetSize({ mode: 'crop', widthCm: rect.widthCm, heightCm: rect.heightCm })
    }
  }

  return (
    <section
      data-testid="placement-inspector"
      style={{
        borderTop: '1px solid #d0d0d0',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontSize: 12,
      }}
    >
      <strong style={{ fontSize: 12 }}>Selected photo</strong>
      <div style={{ color: '#444' }}>
        {label} — {ROUND(resolved.widthCm)} × {ROUND(resolved.heightCm)} cm
      </div>
      <div
        role="group"
        aria-label="Sizing mode"
        style={{ display: 'flex', gap: 4 }}
      >
        <button
          type="button"
          aria-pressed={mode === 'aspect'}
          data-testid="size-mode-aspect"
          onClick={onAspectClick}
          style={modeButtonStyle(mode === 'aspect')}
        >
          Aspect
        </button>
        <button
          type="button"
          aria-pressed={mode === 'crop'}
          data-testid="size-mode-crop"
          onClick={onCropClick}
          style={modeButtonStyle(mode === 'crop')}
        >
          Crop
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {A_SERIES_PRESETS.map((preset) => {
          const active = label === preset.label
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.longEdgeCm)}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid #c0c0c0',
                background: active ? '#e6efff' : '#fff',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
      {mode === 'aspect' ? (
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Long edge (cm)
          <input
            type="number"
            min={1}
            step={0.1}
            value={ROUND(placement.size.longEdgeCm)}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n) && n > 0)
                onSetSize({ mode: 'aspect', longEdgeCm: n })
            }}
          />
        </label>
      ) : (
        <>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Width (cm)
            <input
              type="number"
              min={1}
              step={0.1}
              value={ROUND(placement.size.widthCm)}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n > 0)
                  onSetSize({
                    mode: 'crop',
                    widthCm: n,
                    heightCm: placement.size.mode === 'crop'
                      ? placement.size.heightCm
                      : resolved.heightCm,
                  })
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Height (cm)
            <input
              type="number"
              min={1}
              step={0.1}
              value={ROUND(placement.size.heightCm)}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n > 0)
                  onSetSize({
                    mode: 'crop',
                    widthCm: placement.size.mode === 'crop'
                      ? placement.size.widthCm
                      : resolved.widthCm,
                    heightCm: n,
                  })
              }}
            />
          </label>
          <button
            type="button"
            data-testid="swap-crop-orientation"
            onClick={onSwapCropOrientation}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #c0c0c0',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Swap W↔H
          </button>
        </>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button
          type="button"
          onClick={onDelete}
          style={{
            flex: 1,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #d0d0d0',
            background: 'transparent',
            color: '#a11',
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </div>
    </section>
  )
}

function modeButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid #c0c0c0',
    background: active ? '#e6efff' : '#fff',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  }
}

/**
 * For a crop rectangle, the preset label reflects the rectangle's *long edge*.
 * E.g. a 42×29.7 (or 29.7×42) crop is "A3".
 */
function presetLabelForCrop(widthCm: number, heightCm: number): string {
  const longEdge = Math.max(widthCm, heightCm)
  return resolveSizeLabel(longEdge)
}
