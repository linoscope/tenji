import { applySizeChoice, type SizeChoice } from '../geometry/sizing'
import type { AppState, Placement, PlacementSize, Wall } from './types'

export const DEFAULT_WALL_WIDTH_CM = 800
export const DEFAULT_WALL_HEIGHT_CM = 250
/** Default long edge for a freshly placed photo (A3). */
export const DEFAULT_PLACEMENT_LONG_EDGE_CM = 42

/**
 * Migrate a legacy placement that stored `longEdgeCm` directly into the new
 * `size` discriminated union. Idempotent — if `size` already exists, returns
 * the placement untouched.
 */
export function migratePlacementSize(
  raw: Placement | (Omit<Placement, 'size'> & { longEdgeCm?: number }),
): Placement {
  const anyP = raw as Placement & { longEdgeCm?: number }
  if (anyP.size) {
    return {
      id: anyP.id,
      photoId: anyP.photoId,
      wallId: anyP.wallId,
      xCm: anyP.xCm,
      yCm: anyP.yCm,
      size: anyP.size,
    }
  }
  return {
    id: anyP.id,
    photoId: anyP.photoId,
    wallId: anyP.wallId,
    xCm: anyP.xCm,
    yCm: anyP.yCm,
    size: {
      mode: 'aspect',
      longEdgeCm: anyP.longEdgeCm ?? DEFAULT_PLACEMENT_LONG_EDGE_CM,
    },
  }
}

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

export type PastePlacementItem = {
  placementId: string
  photoId: string
  wallId: string
  xCm: number
  yCm: number
  size: PlacementSize
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
  | { type: 'pastePlacements'; items: PastePlacementItem[] }
  | {
      type: 'duplicateWall'
      sourceId: string
      newWallId: string
      /** Optional override; defaults to `"<source name> copy"`. */
      name?: string
      /**
       * One id per source-wall placement, in the same order the placements
       * appear in `state.placements`. Empty array allowed for empty walls.
       */
      newPlacementIds: string[]
    }
  | { type: 'movePlacement'; id: string; xCm: number; yCm: number }
  | { type: 'moveSelection'; dxCm: number; dyCm: number }
  | { type: 'setPlacementSize'; id: string; size: PlacementSize }
  | { type: 'swapPlacementCropOrientation'; id: string }
  | { type: 'resizeSelection'; ids: string[]; choice: SizeChoice }
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
      const placements = (action.state.placements as Placement[]).map((p) =>
        migratePlacementSize(p),
      )
      return {
        ...action.state,
        placements,
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
      const newPlacements: Placement[] = action.items.map((it) => ({
        id: it.placementId,
        photoId: it.photoId,
        wallId: it.wallId,
        xCm: it.xCm,
        yCm: it.yCm,
        size: { mode: 'aspect', longEdgeCm: DEFAULT_PLACEMENT_LONG_EDGE_CM },
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
    case 'pastePlacements': {
      if (action.items.length === 0) return state
      const newPlacements: Placement[] = action.items.map((it) => ({
        id: it.placementId,
        photoId: it.photoId,
        wallId: it.wallId,
        xCm: it.xCm,
        yCm: it.yCm,
        size: it.size,
      }))
      return {
        ...state,
        placements: [...state.placements, ...newPlacements],
        ui: {
          ...state.ui,
          selectedPlacementIds: newPlacements.map((p) => p.id),
        },
      }
    }
    case 'duplicateWall': {
      const sourceIndex = state.walls.findIndex((w) => w.id === action.sourceId)
      if (sourceIndex === -1) return state
      const source = state.walls[sourceIndex]
      const sourcePlacements = state.placements.filter(
        (p) => p.wallId === action.sourceId,
      )
      const newWall: Wall = {
        id: action.newWallId,
        name: action.name ?? `${source.name} copy`,
        widthCm: source.widthCm,
        heightCm: source.heightCm,
      }
      const clones: Placement[] = sourcePlacements.map((p, i) => ({
        id: action.newPlacementIds[i],
        photoId: p.photoId,
        wallId: newWall.id,
        xCm: p.xCm,
        yCm: p.yCm,
        size: p.size,
      }))
      const walls = [
        ...state.walls.slice(0, sourceIndex + 1),
        newWall,
        ...state.walls.slice(sourceIndex + 1),
      ]
      return {
        ...state,
        walls,
        placements: [...state.placements, ...clones],
        ui: {
          ...state.ui,
          activeWallId: newWall.id,
          selectedPlacementIds: [],
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
    case 'setPlacementSize':
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.id === action.id ? { ...p, size: action.size } : p,
        ),
      }
    case 'resizeSelection': {
      if (action.ids.length === 0) return state
      const ids = new Set(action.ids)
      const photoById = new Map(state.photos.map((p) => [p.id, p]))
      let changed = false
      const placements = state.placements.map((p) => {
        if (!ids.has(p.id)) return p
        const photo = photoById.get(p.photoId)
        if (!photo) return p
        const nextSize = applySizeChoice(p.size, photo.aspectRatio, action.choice)
        changed = true
        return { ...p, size: nextSize }
      })
      if (!changed) return state
      return { ...state, placements }
    }
    case 'swapPlacementCropOrientation':
      return {
        ...state,
        placements: state.placements.map((p) => {
          if (p.id !== action.id) return p
          if (p.size.mode !== 'crop') return p
          if (p.size.widthCm === p.size.heightCm) return p
          return {
            ...p,
            size: {
              mode: 'crop',
              widthCm: p.size.heightCm,
              heightCm: p.size.widthCm,
            },
          }
        }),
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
