import { useEffect, useReducer, useRef, useState } from 'react'
import { appReducer, initialState } from './state/reducer'
import type { StatePort } from './storage/port'
import { createIdbStatePort } from './storage/idbStatePort'
import WallStage from './ui/WallStage'

type AppProps = {
  port?: StatePort
  createId?: () => string
}

const defaultCreateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random())

export default function App({ port, createId = defaultCreateId }: AppProps) {
  const portRef = useRef<StatePort>(port ?? createIdbStatePort())
  const [state, dispatch] = useReducer(appReducer, initialState)
  const [hydrated, setHydrated] = useState(false)

  // Load saved state once; if there is nothing to restore, start with a wall.
  useEffect(() => {
    let cancelled = false
    portRef.current.load().then((saved) => {
      if (cancelled) return
      if (saved && saved.walls.length > 0) {
        dispatch({ type: 'hydrate', state: saved })
      } else {
        dispatch({ type: 'createWall', id: createId() })
      }
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [createId])

  // Persist after every change, once we have finished hydrating.
  useEffect(() => {
    if (!hydrated) return
    void portRef.current.save(state)
  }, [state, hydrated])

  const activeWall =
    state.walls.find((w) => w.id === state.ui.activeWallId) ?? state.walls[0]

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <aside
        style={{
          width: 220,
          borderRight: '1px solid #d0d0d0',
          padding: 16,
          boxSizing: 'border-box',
          background: '#fafafa',
        }}
      >
        <h1 style={{ fontSize: 16, margin: '0 0 12px' }}>Tenji</h1>
        <button onClick={() => dispatch({ type: 'createWall', id: createId() })}>
          + Add wall
        </button>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
          {state.walls.map((wall) => (
            <li
              key={wall.id}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                fontWeight: wall.id === state.ui.activeWallId ? 600 : 400,
              }}
            >
              {wall.name}{' '}
              <span style={{ color: '#888', fontSize: 12 }}>
                {wall.widthCm}×{wall.heightCm} cm
              </span>
            </li>
          ))}
        </ul>
      </aside>
      {activeWall ? <WallStage wall={activeWall} /> : null}
    </div>
  )
}
