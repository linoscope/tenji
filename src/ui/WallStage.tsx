import { useEffect, useRef, useState } from 'react'
import type { Wall } from '../state/types'
import { computeFitScale } from '../geometry/scale'
import WallView from './WallView'

const MARGIN_PX = 48

type WallStageProps = {
  wall: Wall
}

/**
 * Measures its own box and renders the wall fit-to-screen inside it, so the
 * whole wall is always visible with margin around it for parking.
 */
export default function WallStage({ wall }: WallStageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setViewport({ width: el.clientWidth, height: el.clientHeight })
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
      <WallView wall={wall} scale={Number.isFinite(scale) ? scale : 0} />
    </div>
  )
}
