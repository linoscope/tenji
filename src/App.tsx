import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { initialState } from './state/reducer'
import {
  createHistoryState,
  historyReducer,
  type HistoryAction,
  type HistoryState,
} from './state/history'
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
import type { ExportPort } from './export/exportPort'
import { createHtmlToImageExportPort } from './export/exportPort'
import { triggerBlobDownload } from './export/download'
import { wallExportFilename } from './export/filename'
import WallStage from './ui/WallStage'
import PhotoTray from './ui/PhotoTray'
import PlacementInspector from './ui/PlacementInspector'
import PrintShop from './ui/PrintShop'
import ProjectShare from './ui/ProjectShare'
import { computeTrayItems } from './tray/trayView'
import {
  buildProjectEnvelope,
  parseProjectEnvelope,
} from './projectShare/envelope'
import type { Base64ToBlob, BlobToBase64 } from './projectShare/io'
import {
  browserBase64ToBlob,
  browserBlobToBase64,
} from './projectShare/io'
import { projectExportFilename } from './projectShare/filename'

type AppProps = {
  port?: StatePort
  blobStore?: BlobStore
  createId?: () => string
  imageOps?: { decodeImage: DecodeImage; downscale: Downscale }
  exportPort?: ExportPort
  downloadBlob?: (blob: Blob, filename: string) => void
  projectIo?: {
    blobToBase64: BlobToBase64
    base64ToBlob: Base64ToBlob
    now: () => Date
  }
  confirmReplace?: (message: string) => boolean
  /** Injected clock for history coalescing (ms timestamps). */
  historyNow?: () => number
}

const REPLACE_PROMPT = 'Importing replaces your current plan. Continue?'

function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('expected string'))
    }
    reader.readAsText(file)
  })
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
  exportPort,
  downloadBlob = triggerBlobDownload,
  projectIo,
  confirmReplace = (msg) =>
    typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(msg)
      : true,
  historyNow,
}: AppProps) {
  const portRef = useRef<StatePort>(port ?? createIdbStatePort())
  const blobStoreRef = useRef<BlobStore>(blobStore ?? createIdbBlobStore())
  const exportPortRef = useRef<ExportPort>(
    exportPort ?? createHtmlToImageExportPort(),
  )
  const wallRef = useRef<HTMLElement | null>(null)
  const decodeImage = imageOps?.decodeImage ?? browserDecodeImage
  const downscale = imageOps?.downscale ?? browserDownscale
  const blobToBase64 = projectIo?.blobToBase64 ?? browserBlobToBase64
  const base64ToBlob = projectIo?.base64ToBlob ?? browserBase64ToBlob
  const projectNowRef = useRef<() => Date>(projectIo?.now ?? (() => new Date()))
  const historyNowRef = useRef<() => number>(historyNow ?? (() => Date.now()))
  const wrappedReducer = useMemo(
    () => (s: HistoryState, a: HistoryAction) =>
      historyReducer(s, a, historyNowRef.current),
    [],
  )
  const [history, dispatch] = useReducer(
    wrappedReducer,
    initialState,
    createHistoryState,
  )
  const state = history.present
  const [hydrated, setHydrated] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [projectBusy, setProjectBusy] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)

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
  const selectedPlacementIds = state.ui.selectedPlacementIds
  const selectionCount = selectedPlacementIds.length
  const soleSelectedPlacement =
    selectionCount === 1
      ? state.placements.find((p) => p.id === selectedPlacementIds[0])
      : undefined
  const soleSelectedPhoto = soleSelectedPlacement
    ? state.photos.find((p) => p.id === soleSelectedPlacement.photoId)
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

  // Keyboard: Delete/Backspace deletes the selection, Escape clears it,
  // ⌘/Ctrl+Z undoes, ⌘⇧Z / Ctrl+Y / Ctrl+Shift+Z redoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't swallow keys when the user is typing in an input/textarea/contenteditable.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        dispatch(e.shiftKey ? { type: 'redo' } : { type: 'undo' })
        return
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        dispatch({ type: 'redo' })
        return
      }
      if (selectionCount === 0) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        dispatch({ type: 'deleteSelection' })
      } else if (e.key === 'Escape') {
        e.preventDefault()
        dispatch({ type: 'clearSelection' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectionCount])

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

  const exportProject = useCallback(async () => {
    setProjectError(null)
    setProjectBusy(true)
    try {
      const envelope = await buildProjectEnvelope({
        state,
        loadBlob: (key) => blobStoreRef.current.load(key),
        blobToBase64,
        now: projectNowRef.current,
      })
      const json = JSON.stringify(envelope)
      const blob = new Blob([json], { type: 'application/json' })
      downloadBlob(blob, projectExportFilename(projectNowRef.current()))
    } finally {
      setProjectBusy(false)
    }
  }, [state, blobToBase64, downloadBlob])

  const importProject = useCallback(
    async (file: File) => {
      setProjectError(null)
      setProjectBusy(true)
      try {
        const text = await readFileAsText(file)
        let raw: unknown
        try {
          raw = JSON.parse(text)
        } catch {
          setProjectError('Could not read project file (invalid JSON).')
          return
        }
        const result = parseProjectEnvelope(raw)
        if (!result.ok) {
          setProjectError(`Could not read project file (${result.error}).`)
          return
        }
        const isEmpty =
          state.walls.length === 0 && state.photos.length === 0
        if (!isEmpty && !confirmReplace(REPLACE_PROMPT)) return
        // Restore image blobs first so the new state has data to display.
        for (const [key, dataUrl] of Object.entries(result.envelope.images)) {
          const blob = await base64ToBlob(dataUrl)
          await blobStoreRef.current.save(key, blob)
        }
        dispatch({ type: 'hydrate', state: result.envelope.state })
      } finally {
        setProjectBusy(false)
      }
    },
    [state.walls.length, state.photos.length, confirmReplace, base64ToBlob],
  )

  const exportActiveWall = useCallback(async () => {
    if (!activeWall) return
    const el = wallRef.current
    if (!el) return
    setExporting(true)
    // Clear selection so resize handles/outline don't bake into the image.
    dispatch({ type: 'clearSelection' })
    // Wait one paint so the re-rendered (handle-free) wall is what we capture.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    try {
      const blob = await exportPortRef.current.exportElement(el)
      downloadBlob(blob, wallExportFilename(activeWall.name))
    } finally {
      setExporting(false)
    }
  }, [activeWall, downloadBlob])

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
        <OverlayControls
          rulerEnabled={state.ui.rulerEnabled}
          silhouetteEnabled={state.ui.silhouetteEnabled}
          onToggleRuler={() => dispatch({ type: 'toggleRuler' })}
          onToggleSilhouette={() => dispatch({ type: 'toggleSilhouette' })}
        />
        {activeWall ? (
          <button
            type="button"
            onClick={() => void exportActiveWall()}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export PNG'}
          </button>
        ) : null}
        {selectionCount === 1 && soleSelectedPlacement && soleSelectedPhoto ? (
          <PlacementInspector
            key={soleSelectedPlacement.id}
            placement={soleSelectedPlacement}
            photo={soleSelectedPhoto}
            onResize={(longEdgeCm) =>
              dispatch({
                type: 'resizePlacement',
                id: soleSelectedPlacement.id,
                longEdgeCm,
              })
            }
            onSendToTray={() =>
              dispatch({
                type: 'sendPlacementToTray',
                id: soleSelectedPlacement.id,
              })
            }
            onDeletePhoto={() =>
              dispatch({ type: 'deletePhoto', id: soleSelectedPhoto.id })
            }
          />
        ) : null}
        {selectionCount >= 2 ? (
          <GroupInspector
            count={selectionCount}
            onDeleteAll={() => dispatch({ type: 'deleteSelection' })}
            onSendAllToTray={() => dispatch({ type: 'sendSelectionToTray' })}
          />
        ) : null}
        <PhotoTray
          items={computeTrayItems({
            photos: state.photos,
            placements: state.placements,
            walls: state.walls,
          })}
          blobStore={blobStoreRef.current}
          onImportFiles={importFiles}
        />
        <PrintShop
          photos={state.photos}
          placements={state.placements}
          walls={state.walls}
          blobStore={blobStoreRef.current}
          downloadBlob={downloadBlob}
        />
        <ProjectShare
          onExport={() => void exportProject()}
          onPickImportFile={(file) => void importProject(file)}
          error={projectError}
          busy={projectBusy}
        />
      </aside>
      {activeWall ? (
        <WallStage
          wall={activeWall}
          wallRef={wallRef}
          placements={state.placements.filter((p) => p.wallId === activeWall.id)}
          photos={state.photos}
          blobStore={blobStoreRef.current}
          selectedPlacementIds={state.ui.selectedPlacementIds}
          rulerEnabled={state.ui.rulerEnabled}
          silhouetteEnabled={state.ui.silhouetteEnabled}
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
          onToggleSelectPlacement={(id) =>
            dispatch({ type: 'toggleSelectPlacement', id })
          }
          onClearSelection={() => dispatch({ type: 'clearSelection' })}
          onSetSelection={(ids) => dispatch({ type: 'setSelection', ids })}
          onMovePlacement={(id, xCm, yCm) =>
            dispatch({ type: 'movePlacement', id, xCm, yCm })
          }
          onMoveSelection={(dxCm, dyCm) =>
            dispatch({ type: 'moveSelection', dxCm, dyCm })
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

type OverlayControlsProps = {
  rulerEnabled: boolean
  silhouetteEnabled: boolean
  onToggleRuler: () => void
  onToggleSilhouette: () => void
}

function OverlayControls({
  rulerEnabled,
  silhouetteEnabled,
  onToggleRuler,
  onToggleSilhouette,
}: OverlayControlsProps) {
  return (
    <section
      style={{
        borderTop: '1px solid #d0d0d0',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 12,
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          checked={rulerEnabled}
          onChange={onToggleRuler}
        />
        Ruler
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          checked={silhouetteEnabled}
          onChange={onToggleSilhouette}
        />
        Silhouette
      </label>
    </section>
  )
}

type GroupInspectorProps = {
  count: number
  onDeleteAll: () => void
  onSendAllToTray: () => void
}

function GroupInspector({ count, onDeleteAll, onSendAllToTray }: GroupInspectorProps) {
  return (
    <section
      data-testid="group-inspector"
      style={{
        borderTop: '1px solid #d0d0d0',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontSize: 12,
      }}
    >
      <strong style={{ fontSize: 12 }}>{count} selected</strong>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          onClick={onSendAllToTray}
          style={{
            flex: 1,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #c0c0c0',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Send all to tray
        </button>
        <button
          type="button"
          onClick={onDeleteAll}
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
          Delete all
        </button>
      </div>
    </section>
  )
}
