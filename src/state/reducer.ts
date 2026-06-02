import type { AppState } from './types'

export const DEFAULT_WALL_WIDTH_CM = 800
export const DEFAULT_WALL_HEIGHT_CM = 250

export const initialState: AppState = {
  photos: [],
  walls: [],
  placements: [],
  ui: { activeWallId: null },
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
  | { type: 'hydrate'; state: AppState }

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state
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
