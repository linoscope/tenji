import type { Photo, Placement } from '../state/types'
import {
  A_SERIES_PRESETS,
  computeSizeFromLongEdge,
  resolveSizeLabel,
} from '../geometry/sizing'

type PlacementInspectorProps = {
  placement: Placement
  photo: Photo
  onResize: (longEdgeCm: number) => void
}

const ROUND = (n: number) => Math.round(n * 10) / 10

export default function PlacementInspector({
  placement,
  photo,
  onResize,
}: PlacementInspectorProps) {
  const size = computeSizeFromLongEdge(placement.longEdgeCm, photo.aspectRatio)
  const label = resolveSizeLabel(placement.longEdgeCm)

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
        {label} — {ROUND(size.widthCm)} × {ROUND(size.heightCm)} cm
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {A_SERIES_PRESETS.map((preset) => {
          const active = label === preset.label
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onResize(preset.longEdgeCm)}
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
      <label style={{ display: 'flex', flexDirection: 'column' }}>
        Long edge (cm)
        <input
          type="number"
          min={1}
          step={0.1}
          value={ROUND(placement.longEdgeCm)}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n > 0) onResize(n)
          }}
        />
      </label>
    </section>
  )
}
