import type { AppState } from './types'

export const DEFAULT_WALL_WIDTH_CM = 800
export const DEFAULT_WALL_HEIGHT_CM = 250
/** Default long edge for a freshly placed photo (A3). */
export const DEFAULT_PLACEMENT_LONG_EDGE_CM = 42

export const initialState: AppState = {
  photos: [],
  walls: [],
  placements: [],
  ui: {
    activeWallId: null,
    selectedPlacementIds: [],
    rulerEnabled: true,
    silhouetteEnabled: true,
  },
}

export type ImportPhotoItem = {
  photoId: string
  filename: string
  blobKey: string
  aspectRatio: number
  placementId: string
  wallId: string
  xCm: number
  yCm: number
}

export type Action =
  | {
      type: 'createWall'
      id: string
      name?: string
      widthCm?: number
      heightCm?: number
    }
  | { type: 'selectWall'; id: string }
  | { type: 'renameWall'; id: string; name: string }
  | { type: 'resizeWall'; id: string; widthCm: number; heightCm: number }
  | { type: 'deleteWall'; id: string }
  | { type: 'importPhotos'; items: ImportPhotoItem[] }
  | { type: 'movePlacement'; id: string; xCm: number; yCm: number }
  | { type: 'moveSelection'; dxCm: number; dyCm: number }
  | { type: 'resizePlacement'; id: string; longEdgeCm: number }
  | { type: 'selectPlacement'; id: string }
  | { type: 'toggleSelectPlacement'; id: string }
  | { type: 'setSelection'; ids: string[] }
  | { type: 'clearSelection' }
  | { type: 'deleteSelection' }
  | { type: 'toggleRuler' }
  | { type: 'toggleSilhouette' }
  | { type: 'hydrate'; state: AppState }

function dedupe(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate': {
      // Backwards-compat: older snapshots predate overlay flags + multi-select.
      const ui = action.state.ui as AppState['ui'] & {
        selectedPlacementId?: string | null
      }
      const ids = Array.isArray(ui.selectedPlacementIds)
        ? ui.selectedPlacementIds
        : ui.selectedPlacementId
          ? [ui.selectedPlacementId]
          : []
      return {
        ...action.state,
        ui: {
          activeWallId: ui.activeWallId ?? null,
          selectedPlacementIds: ids,
          rulerEnabled: ui.rulerEnabled ?? true,
          silhouetteEnabled: ui.silhouetteEnabled ?? true,
        },
      }
    }
    case 'toggleRuler':
      return {
        ...state,
        ui: { ...state.ui, rulerEnabled: !state.ui.rulerEnabled },
      }
    case 'toggleSilhouette':
      return {
        ...state,
        ui: { ...state.ui, silhouetteEnabled: !state.ui.silhouetteEnabled },
      }
    case 'createWall': {
      const wall = {
        id: action.id,
        name: action.name ?? `Wall ${state.walls.length + 1}`,
        widthCm: action.widthCm ?? DEFAULT_WALL_WIDTH_CM,
        heightCm: action.heightCm ?? DEFAULT_WALL_HEIGHT_CM,
      }
      return {
        ...state,
        walls: [...state.walls, wall],
        ui: {
          ...state.ui,
          activeWallId: wall.id,
          selectedPlacementIds: [],
        },
      }
    }
    case 'selectWall':
      return {
        ...state,
        ui: {
          ...state.ui,
          activeWallId: action.id,
          selectedPlacementIds: [],
        },
      }
    case 'renameWall':
      return {
        ...state,
        walls: state.walls.map((w) =>
          w.id === action.id ? { ...w, name: action.name } : w,
        ),
      }
    case 'resizeWall':
      return {
        ...state,
        walls: state.walls.map((w) =>
          w.id === action.id
            ? { ...w, widthCm: action.widthCm, heightCm: action.heightCm }
            : w,
        ),
      }
    case 'importPhotos': {
      if (action.items.length === 0) return state
      const newPhotos = action.items.map((it) => ({
        id: it.photoId,
        filename: it.filename,
        blobKey: it.blobKey,
        aspectRatio: it.aspectRatio,
      }))
      const newPlacements = action.items.map((it) => ({
        id: it.placementId,
        photoId: it.photoId,
        wallId: it.wallId,
        xCm: it.xCm,
        yCm: it.yCm,
        longEdgeCm: DEFAULT_PLACEMENT_LONG_EDGE_CM,
      }))
      return {
        ...state,
        photos: [...state.photos, ...newPhotos],
        placements: [...state.placements, ...newPlacements],
        ui: {
          ...state.ui,
          selectedPlacementIds: newPlacements.map((p) => p.id),
        },
      }
    }
    case 'movePlacement':
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.id === action.id ? { ...p, xCm: action.xCm, yCm: action.yCm } : p,
        ),
      }
    case 'moveSelection': {
      const selected = new Set(state.ui.selectedPlacementIds)
      if (selected.size === 0) return state
      return {
        ...state,
        placements: state.placements.map((p) =>
          selected.has(p.id)
            ? { ...p, xCm: p.xCm + action.dxCm, yCm: p.yCm + action.dyCm }
            : p,
        ),
      }
    }
    case 'resizePlacement':
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.id === action.id ? { ...p, longEdgeCm: action.longEdgeCm } : p,
        ),
      }
    case 'selectPlacement':
      return {
        ...state,
        ui: { ...state.ui, selectedPlacementIds: [action.id] },
      }
    case 'toggleSelectPlacement': {
      const current = state.ui.selectedPlacementIds
      const has = current.includes(action.id)
      const next = has
        ? current.filter((id) => id !== action.id)
        : dedupe([...current, action.id])
      return { ...state, ui: { ...state.ui, selectedPlacementIds: next } }
    }
    case 'setSelection':
      return {
        ...state,
        ui: { ...state.ui, selectedPlacementIds: dedupe(action.ids) },
      }
    case 'clearSelection':
      return { ...state, ui: { ...state.ui, selectedPlacementIds: [] } }
    case 'deleteSelection': {
      const selected = new Set(state.ui.selectedPlacementIds)
      if (selected.size === 0) return state
      const placements = state.placements.filter((p) => !selected.has(p.id))
      return {
        ...state,
        placements,
        ui: { ...state.ui, selectedPlacementIds: [] },
      }
    }
    case 'deleteWall': {
      const walls = state.walls.filter((w) => w.id !== action.id)
      const removedPlacementIds = new Set(
        state.placements.filter((p) => p.wallId === action.id).map((p) => p.id),
      )
      const placements = state.placements.filter((p) => p.wallId !== action.id)
      const wasActive = state.ui.activeWallId === action.id
      const activeWallId = wasActive
        ? (walls[0]?.id ?? null)
        : state.ui.activeWallId
      const selectedPlacementIds = wasActive
        ? []
        : state.ui.selectedPlacementIds.filter(
            (id) => !removedPlacementIds.has(id),
          )
      return {
        ...state,
        walls,
        placements,
        ui: { ...state.ui, activeWallId, selectedPlacementIds },
      }
    }
    default:
      return state
  }
}
