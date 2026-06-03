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
import PlacementInspector from './ui/PlacementInspector'
import PrintShop from './ui/PrintShop'
import ProjectShare from './ui/ProjectShare'
import { computeMarginTilePositions } from './geometry/marginTiles'
import { DEFAULT_PLACEMENT_LONG_EDGE_CM } from './state/reducer'
import type { ImportPhotoItem, PastePlacementItem } from './state/reducer'
import {
  buildClipboardEntries,
  computeCentroid,
  computePastePositions,
  type ClipboardEntry,
} from './clipboard/pasteTransform'
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
  // Stable ref so async file imports use the wall that's active at the time
  // the dispatch fires (not the one captured when the picker was opened).
  const activeWallRef = useRef(activeWall)
  activeWallRef.current = activeWall
  const selectedPlacementIds = state.ui.selectedPlacementIds
  const selectionCount = selectedPlacementIds.length

  // In-app clipboard. Stored in a ref (not state) because changing it doesn't
  // need to rerender the app — paste reads it on demand. Survives wall switches
  // and re-renders. Reset to null only when explicitly cleared.
  type ClipboardContents = {
    entries: ClipboardEntry[]
    sourceWallId: string
    sourceCenter: { xCm: number; yCm: number }
  }
  const clipboardRef = useRef<ClipboardContents | null>(null)
  const [clipboardVersion, setClipboardVersion] = useState(0)
  const clipboardHasContent = clipboardVersion > 0 && clipboardRef.current !== null

  // Right-click context menu. `kind` decides which items to render:
  //  - 'placement' (right-clicked a photo / multi-selection): Copy, Delete, Paste
  //  - 'empty' (right-clicked the bare stage background): Paste only
  type ContextMenu =
    | { kind: 'placement'; xPx: number; yPx: number }
    | { kind: 'empty'; xPx: number; yPx: number }
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const soleSelectedPlacement =
    selectionCount === 1
      ? state.placements.find((p) => p.id === selectedPlacementIds[0])
      : undefined
  const soleSelectedPhoto = soleSelectedPlacement
    ? state.photos.find((p) => p.id === soleSelectedPlacement.photoId)
    : undefined

  const importFiles = async (files: FileList | File[]) => {
    const wall = activeWallRef.current
    if (!wall) return
    const imports: { photoId: string; filename: string; blobKey: string; aspectRatio: number }[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const photo = await importPhotoFile({
        file,
        blobStore: blobStoreRef.current,
        createId,
        decodeImage,
        downscale,
      })
      imports.push({
        photoId: photo.id,
        filename: photo.filename,
        blobKey: photo.blobKey,
        aspectRatio: photo.aspectRatio,
      })
    }
    if (imports.length === 0) return
    const positions = computeMarginTilePositions({
      longEdgeCm: DEFAULT_PLACEMENT_LONG_EDGE_CM,
      photos: imports.map((p) => ({ aspectRatio: p.aspectRatio })),
      wallWidthCm: wall.widthCm,
      wallHeightCm: wall.heightCm,
    })
    const items: ImportPhotoItem[] = imports.map((p, i) => ({
      ...p,
      placementId: createId(),
      wallId: wall.id,
      xCm: positions[i].xCm,
      yCm: positions[i].yCm,
    }))
    dispatch({ type: 'importPhotos', items })
  }

  /**
   * Snapshot the current selection into the in-app clipboard as descriptors.
   * No-op if the selection is empty.
   */
  const copySelection = useCallback(() => {
    const ids = state.ui.selectedPlacementIds
    if (ids.length === 0) return
    const sources = state.placements.filter((p) => ids.includes(p.id))
    if (sources.length === 0) return
    const entries = buildClipboardEntries(sources)
    const sourceCenter = computeCentroid(sources)
    // Every source in a copy comes from the same active wall (selection is per-wall).
    const sourceWallId = sources[0].wallId
    clipboardRef.current = { entries, sourceWallId, sourceCenter }
    setClipboardVersion((v) => v + 1)
  }, [state])

  /** Paste the in-app clipboard onto the active wall. No-op if clipboard is empty. */
  const pasteFromClipboard = useCallback(() => {
    const cb = clipboardRef.current
    const wall = activeWallRef.current
    if (!cb || !wall) return
    const sameWall = cb.sourceWallId === wall.id
    const positions = computePastePositions({
      entries: cb.entries,
      sourceCenter: cb.sourceCenter,
      sameWall,
      wall: { widthCm: wall.widthCm, heightCm: wall.heightCm },
    })
    const items: PastePlacementItem[] = positions.map((pos, i) => ({
      placementId: createId(),
      photoId: cb.entries[i].photoId,
      wallId: wall.id,
      xCm: pos.xCm,
      yCm: pos.yCm,
      longEdgeCm: pos.longEdgeCm,
    }))
    if (items.length === 0) return
    dispatch({ type: 'pastePlacements', items })
  }, [createId])

  // Keyboard: Delete/Backspace deletes the selection, Escape clears it,
  // ⌘/Ctrl+Z undoes, ⌘⇧Z / Ctrl+Y / Ctrl+Shift+Z redoes,
  // ⌘/Ctrl+C copies the current selection into the in-app clipboard.
  // (⌘/Ctrl+V is handled by the paste-event listener so it can disambiguate
  // between OS-clipboard images and the in-app clipboard.)
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
      if (mod && (e.key === 'c' || e.key === 'C')) {
        if (selectionCount === 0) return
        e.preventDefault()
        copySelection()
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
  }, [selectionCount, copySelection])

  // Clipboard paste: content decides.
  //  - If the OS clipboard has image data, import it (existing behavior).
  //  - Else, if the in-app clipboard holds placements, paste them onto the
  //    active wall. No mode toggle — the content is what disambiguates.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Don't hijack paste inside form inputs.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      const items = e.clipboardData?.items
      const files: File[] = []
      if (items) {
        for (const item of Array.from(items)) {
          if (item.kind === 'file') {
            const f = item.getAsFile()
            if (f && f.type.startsWith('image/')) files.push(f)
          }
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        void importFiles(files)
        return
      }
      if (clipboardRef.current !== null) {
        e.preventDefault()
        pasteFromClipboard()
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteFromClipboard])

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
            onDelete={() => dispatch({ type: 'deleteSelection' })}
          />
        ) : null}
        {selectionCount >= 2 ? (
          <GroupInspector
            count={selectionCount}
            onDeleteAll={() => dispatch({ type: 'deleteSelection' })}
          />
        ) : null}
        <PhotoImportButton onImportFiles={importFiles} />
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
          onContextMenuPlacement={(_id, clientX, clientY) =>
            setContextMenu({ kind: 'placement', xPx: clientX, yPx: clientY })
          }
          onContextMenuEmpty={(clientX, clientY) =>
            setContextMenu({ kind: 'empty', xPx: clientX, yPx: clientY })
          }
        />
      ) : null}
      {contextMenu ? (
        <ContextMenu
          kind={contextMenu.kind}
          xPx={contextMenu.xPx}
          yPx={contextMenu.yPx}
          canPaste={clipboardHasContent}
          onCopy={() => {
            copySelection()
            setContextMenu(null)
          }}
          onPaste={() => {
            pasteFromClipboard()
            setContextMenu(null)
          }}
          onDelete={() => {
            dispatch({ type: 'deleteSelection' })
            setContextMenu(null)
          }}
          onDismiss={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  )
}

type ContextMenuProps = {
  kind: 'placement' | 'empty'
  xPx: number
  yPx: number
  canPaste: boolean
  onCopy: () => void
  onPaste: () => void
  onDelete: () => void
  onDismiss: () => void
}

function ContextMenu({
  kind,
  xPx,
  yPx,
  canPaste,
  onCopy,
  onPaste,
  onDelete,
  onDismiss,
}: ContextMenuProps) {
  // Close on outside click / Escape so the menu doesn't linger.
  useEffect(() => {
    const onMouseDown = () => onDismiss()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    // Defer registering the mousedown listener so the contextmenu event that
    // opened us doesn't immediately close us via a same-tick mousedown.
    const t = window.setTimeout(() => {
      window.addEventListener('mousedown', onMouseDown)
    }, 0)
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onDismiss])

  const buttonStyle: React.CSSProperties = {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    padding: '6px 12px',
    textAlign: 'left',
    fontSize: 13,
    cursor: 'pointer',
    color: '#111',
  }
  const disabledStyle: React.CSSProperties = {
    ...buttonStyle,
    cursor: 'not-allowed',
    color: '#999',
  }

  return (
    <div
      data-testid="context-menu"
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: xPx,
        top: yPx,
        background: '#fff',
        border: '1px solid #d0d0d0',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 120,
        zIndex: 1000,
      }}
    >
      {kind === 'placement' ? (
        <>
          <button type="button" onClick={onCopy} style={buttonStyle}>
            Copy
          </button>
          <button
            type="button"
            disabled={!canPaste}
            onClick={canPaste ? onPaste : undefined}
            style={canPaste ? buttonStyle : disabledStyle}
          >
            Paste
          </button>
          <button type="button" onClick={onDelete} style={buttonStyle}>
            Delete
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={!canPaste}
          onClick={canPaste ? onPaste : undefined}
          style={canPaste ? buttonStyle : disabledStyle}
        >
          Paste
        </button>
      )}
    </div>
  )
}

type PhotoImportButtonProps = {
  onImportFiles: (files: FileList | File[]) => void
}

function PhotoImportButton({ onImportFiles }: PhotoImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFiles(e.target.files)
      e.target.value = ''
    }
  }
  return (
    <section
      style={{
        borderTop: '1px solid #d0d0d0',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{ fontSize: 12 }}
      >
        + Import photos
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPickFiles}
        aria-label="Import photos"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1 }}
      />
      <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
        Drop, paste, or pick image files. Imports land in the margin around the wall.
      </p>
    </section>
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
}

function GroupInspector({ count, onDeleteAll }: GroupInspectorProps) {
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
