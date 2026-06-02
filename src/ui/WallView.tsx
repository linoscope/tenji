import type { Wall } from '../state/types'
import { cmToPx } from '../geometry/scale'

type WallViewProps = {
  wall: Wall
  scale: number
}

/** The wall itself, drawn to scale on a plain white background. */
export default function WallView({ wall, scale }: WallViewProps) {
  return (
    <div
      data-testid="wall"
      data-width-cm={wall.widthCm}
      data-height-cm={wall.heightCm}
      style={{
        width: cmToPx(wall.widthCm, scale),
        height: cmToPx(wall.heightCm, scale),
        background: '#ffffff',
        boxShadow: '0 1px 8px rgba(0,0,0,0.15)',
        border: '1px solid #d0d0d0',
      }}
    />
  )
}
