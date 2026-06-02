import { useEffect, useReducer, useRef, useState } from 'react'
import { appReducer, initialState } from './state/reducer'
import type { StatePort } from './storage/port'
import { createIdbStatePort } from './storage/idbStatePort'
import type { BlobStore } from './storage/blobStore'
import { createIdbBlobStore } from './storage/idbBlobStore'
import { importPhotoFile } from './photo/photoImport'
import type { DecodeImage, Downscale } from './photo/photoImport'
import {
  decodeImage as browserDecodeImage,
  downscale as browserDownscale,
} from './photo/browserImageOps'
import WallStage from './ui/WallStage'
import PhotoTray from './ui/PhotoTray'
import PlacementInspector from './ui/PlacementInspector'

type AppProps = {
  port?: StatePort
  blobStore?: BlobStore
  createId?: () => string
  imageOps?: { decodeImage: DecodeImage; downscale: Downscale }
}

const defaultCreateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random())

export default function App({
  port,
  blobStore,
  createId = defaultCreateId,
  imageOps,
}: AppProps) {
  const portRef = useRef<StatePort>(port ?? createIdbStatePort())
  const blobStoreRef = useRef<BlobStore>(blobStore ?? createIdbBlobStore())
  const decodeImage = imageOps?.decodeImage ?? browserDecodeImage
  const downscale = imageOps?.downscale ?? browserDownscale
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
  const selectedPlacement = state.placements.find(
    (p) => p.id === state.ui.selectedPlacementId,
  )
  const selectedPhoto = selectedPlacement
    ? state.photos.find((p) => p.id === selectedPlacement.photoId)
    : undefined

  const importFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const photo = await importPhotoFile({
        file,
        blobStore: blobStoreRef.current,
        createId,
        decodeImage,
        downscale,
      })
      dispatch({ type: 'addPhoto', ...photo })
    }
  }

  // Clipboard paste imports any image items.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile()
          if (f && f.type.startsWith('image/')) files.push(f)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        void importFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) {
      void importFiles(e.dataTransfer.files)
    }
  }
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault()
    }
  }

  return (
    <div
      data-testid="app-root"
      onDrop={onDrop}
      onDragOver={onDragOver}
      style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}
    >
      <aside
        style={{
          width: 240,
          borderRight: '1px solid #d0d0d0',
          padding: 16,
          boxSizing: 'border-box',
          background: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflow: 'auto',
        }}
      >
        <h1 style={{ fontSize: 16, margin: 0 }}>Tenji</h1>
        <button onClick={() => dispatch({ type: 'createWall', id: createId() })}>
          + Add wall
        </button>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {state.walls.map((wall) => {
            const isActive = wall.id === state.ui.activeWallId
            return (
              <li key={wall.id} style={{ marginBottom: 2 }}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'selectWall', id: wall.id })}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid transparent',
                    background: isActive ? '#e6efff' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {wall.name}{' '}
                  <span style={{ color: '#888', fontSize: 12 }}>
                    {wall.widthCm}×{wall.heightCm} cm
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {activeWall ? (
          <WallEditor
            key={activeWall.id}
            wall={activeWall}
            onRename={(name) =>
              dispatch({ type: 'renameWall', id: activeWall.id, name })
            }
            onResize={(widthCm, heightCm) =>
              dispatch({
                type: 'resizeWall',
                id: activeWall.id,
                widthCm,
                heightCm,
              })
            }
            onDelete={() => dispatch({ type: 'deleteWall', id: activeWall.id })}
          />
        ) : null}
        {selectedPlacement && selectedPhoto ? (
          <PlacementInspector
            key={selectedPlacement.id}
            placement={selectedPlacement}
            photo={selectedPhoto}
            onResize={(longEdgeCm) =>
              dispatch({
                type: 'resizePlacement',
                id: selectedPlacement.id,
                longEdgeCm,
              })
            }
          />
        ) : null}
        <PhotoTray
          photos={state.photos}
          blobStore={blobStoreRef.current}
          onImportFiles={importFiles}
        />
      </aside>
      {activeWall ? (
        <WallStage
          wall={activeWall}
          placements={state.placements.filter((p) => p.wallId === activeWall.id)}
          photos={state.photos}
          blobStore={blobStoreRef.current}
          selectedPlacementId={state.ui.selectedPlacementId}
          onDropPhoto={({ photoId, xCm, yCm }) =>
            dispatch({
              type: 'placePhoto',
              id: createId(),
              photoId,
              wallId: activeWall.id,
              xCm,
              yCm,
            })
          }
          onSelectPlacement={(id) =>
            dispatch({ type: 'selectPlacement', id })
          }
          onClearSelection={() => dispatch({ type: 'clearSelection' })}
          onMovePlacement={(id, xCm, yCm) =>
            dispatch({ type: 'movePlacement', id, xCm, yCm })
          }
          onResizePlacement={(id, longEdgeCm) =>
            dispatch({ type: 'resizePlacement', id, longEdgeCm })
          }
        />
      ) : null}
    </div>
  )
}

type WallEditorProps = {
  wall: { id: string; name: string; widthCm: number; heightCm: number }
  onRename: (name: string) => void
  onResize: (widthCm: number, heightCm: number) => void
  onDelete: () => void
}

function WallEditor({ wall, onRename, onResize, onDelete }: WallEditorProps) {
  return (
    <section
      style={{
        borderTop: '1px solid #d0d0d0',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
        Wall name
        <input
          type="text"
          value={wall.name}
          onChange={(e) => onRename(e.target.value)}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
        Width (cm)
        <input
          type="number"
          min={1}
          value={wall.widthCm}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n > 0) onResize(n, wall.heightCm)
          }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
        Height (cm)
        <input
          type="number"
          min={1}
          value={wall.heightCm}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n > 0) onResize(wall.widthCm, n)
          }}
        />
      </label>
      <button
        type="button"
        onClick={onDelete}
        style={{
          marginTop: 4,
          color: '#a11',
          background: 'transparent',
          border: '1px solid #d0d0d0',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
        }}
      >
        Delete wall
      </button>
    </section>
  )
}
