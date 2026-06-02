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
    default:
      return state
  }
}
