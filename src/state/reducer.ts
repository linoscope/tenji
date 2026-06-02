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
    selectedPlacementId: null,
    rulerEnabled: true,
    silhouetteEnabled: true,
  },
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
  | {
      type: 'addPhoto'
      id: string
      filename: string
      blobKey: string
      aspectRatio: number
    }
  | {
      type: 'placePhoto'
      id: string
      photoId: string
      wallId: string
      xCm: number
      yCm: number
    }
  | { type: 'movePlacement'; id: string; xCm: number; yCm: number }
  | { type: 'resizePlacement'; id: string; longEdgeCm: number }
  | { type: 'selectPlacement'; id: string }
  | { type: 'clearSelection' }
  | { type: 'sendPlacementToTray'; id: string }
  | { type: 'deletePhoto'; id: string }
  | { type: 'toggleRuler' }
  | { type: 'toggleSilhouette' }
  | { type: 'hydrate'; state: AppState }

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate': {
      // Backwards-compat: older snapshots may predate the overlay flags.
      const ui = action.state.ui
      return {
        ...action.state,
        ui: {
          ...ui,
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
        ui: { ...state.ui, activeWallId: wall.id },
      }
    }
    case 'selectWall':
      return { ...state, ui: { ...state.ui, activeWallId: action.id } }
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
    case 'addPhoto': {
      const photo = {
        id: action.id,
        filename: action.filename,
        blobKey: action.blobKey,
        aspectRatio: action.aspectRatio,
      }
      return { ...state, photos: [...state.photos, photo] }
    }
    case 'placePhoto': {
      const placement = {
        id: action.id,
        photoId: action.photoId,
        wallId: action.wallId,
        xCm: action.xCm,
        yCm: action.yCm,
        longEdgeCm: DEFAULT_PLACEMENT_LONG_EDGE_CM,
      }
      return {
        ...state,
        placements: [...state.placements, placement],
        ui: { ...state.ui, selectedPlacementId: placement.id },
      }
    }
    case 'movePlacement':
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.id === action.id ? { ...p, xCm: action.xCm, yCm: action.yCm } : p,
        ),
      }
    case 'resizePlacement':
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.id === action.id ? { ...p, longEdgeCm: action.longEdgeCm } : p,
        ),
      }
    case 'selectPlacement':
      return { ...state, ui: { ...state.ui, selectedPlacementId: action.id } }
    case 'clearSelection':
      return { ...state, ui: { ...state.ui, selectedPlacementId: null } }
    case 'sendPlacementToTray': {
      const placements = state.placements.filter((p) => p.id !== action.id)
      const selectedPlacementId =
        state.ui.selectedPlacementId === action.id
          ? null
          : state.ui.selectedPlacementId
      return {
        ...state,
        placements,
        ui: { ...state.ui, selectedPlacementId },
      }
    }
    case 'deletePhoto': {
      const photos = state.photos.filter((p) => p.id !== action.id)
      const removedPlacementIds = new Set(
        state.placements.filter((p) => p.photoId === action.id).map((p) => p.id),
      )
      const placements = state.placements.filter(
        (p) => p.photoId !== action.id,
      )
      const selectedPlacementId =
        state.ui.selectedPlacementId &&
        removedPlacementIds.has(state.ui.selectedPlacementId)
          ? null
          : state.ui.selectedPlacementId
      return {
        ...state,
        photos,
        placements,
        ui: { ...state.ui, selectedPlacementId },
      }
    }
    case 'deleteWall': {
      const walls = state.walls.filter((w) => w.id !== action.id)
      const placements = state.placements.filter((p) => p.wallId !== action.id)
      const activeWallId =
        state.ui.activeWallId === action.id
          ? (walls[0]?.id ?? null)
          : state.ui.activeWallId
      return {
        ...state,
        walls,
        placements,
        ui: { ...state.ui, activeWallId },
      }
    }
    default:
      return state
  }
}
