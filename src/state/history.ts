import { appReducer } from './reducer'
import type { Action } from './reducer'
import type { AppState } from './types'

/** Max number of undo entries we keep in memory. */
export const HISTORY_DEPTH_CAP = 100

/** Same-merge-key edits within this gap (ms) collapse into a single step. */
export const HISTORY_IDLE_GAP_MS = 500

/**
 * A snapshot of the document slice of state at the time of an edit.
 * Selection and overlay toggles are intentionally NOT captured — only the
 * "document" + the active wall id where the edit was made.
 */
type DocSnapshot = {
  walls: AppState['walls']
  photos: AppState['photos']
  placements: AppState['placements']
  activeWallId: AppState['ui']['activeWallId']
}

export type HistoryState = {
  past: DocSnapshot[]
  present: AppState
  future: DocSnapshot[]
  lastMergeKey: string | null
  lastEditAt: number | null
}

export type HistoryAction =
  | Action
  | { type: 'undo' }
  | { type: 'redo' }

export function createHistoryState(present: AppState): HistoryState {
  return {
    past: [],
    present,
    future: [],
    lastMergeKey: null,
    lastEditAt: null,
  }
}

function snapshotOf(s: AppState): DocSnapshot {
  return {
    walls: s.walls,
    photos: s.photos,
    placements: s.placements,
    activeWallId: s.ui.activeWallId,
  }
}

function withSnapshot(present: AppState, snap: DocSnapshot): AppState {
  const placementIds = new Set(snap.placements.map((p) => p.id))
  const prunedSelection = present.ui.selectedPlacementIds.filter((id) =>
    placementIds.has(id),
  )
  return {
    walls: snap.walls,
    photos: snap.photos,
    placements: snap.placements,
    ui: {
      ...present.ui,
      activeWallId: snap.activeWallId,
      selectedPlacementIds: prunedSelection,
    },
  }
}

/**
 * Classify an Action as a document edit (with a merge key), a UI-only change,
 * or a reset (e.g., hydrate). Document edits push onto the past; UI-only
 * actions pass through; reset clears history.
 */
function classify(
  action: Action,
):
  | { kind: 'document'; mergeKey: string }
  | { kind: 'ui' }
  | { kind: 'reset' } {
  switch (action.type) {
    case 'hydrate':
      return { kind: 'reset' }
    case 'selectWall':
    case 'selectPlacement':
    case 'toggleSelectPlacement':
    case 'setSelection':
    case 'clearSelection':
    case 'toggleRuler':
    case 'toggleSilhouette':
      return { kind: 'ui' }
    case 'createWall':
      return { kind: 'document', mergeKey: `createWall:${action.id}` }
    case 'renameWall':
      return { kind: 'document', mergeKey: `renameWall:${action.id}` }
    case 'resizeWall':
      return { kind: 'document', mergeKey: `resizeWall:${action.id}` }
    case 'deleteWall':
      return { kind: 'document', mergeKey: `deleteWall:${action.id}` }
    case 'importPhotos': {
      // Unique key per dispatch so successive batch imports never coalesce.
      const ids = action.items.map((i) => i.placementId).join(',')
      return { kind: 'document', mergeKey: `importPhotos:${ids}` }
    }
    case 'pastePlacements': {
      // Unique per dispatch so successive pastes each get their own undo step.
      const ids = action.items.map((i) => i.placementId).join(',')
      return { kind: 'document', mergeKey: `pastePlacements:${ids}` }
    }
    case 'movePlacement':
      return { kind: 'document', mergeKey: `movePlacement:${action.id}` }
    case 'moveSelection':
      return { kind: 'document', mergeKey: 'moveSelection' }
    case 'setPlacementSize':
      return { kind: 'document', mergeKey: `setPlacementSize:${action.id}` }
    case 'swapPlacementCropOrientation':
      return {
        kind: 'document',
        mergeKey: `swapPlacementCropOrientation:${action.id}`,
      }
    case 'deleteSelection':
      return { kind: 'document', mergeKey: 'deleteSelection' }
  }
}

export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
  now: () => number,
): HistoryState {
  if (action.type === 'undo') {
    if (state.past.length === 0) return state
    const prev = state.past[state.past.length - 1]
    const past = state.past.slice(0, -1)
    const future = [snapshotOf(state.present), ...state.future]
    const present = withSnapshot(state.present, prev)
    return {
      past,
      present,
      future,
      lastMergeKey: null,
      lastEditAt: null,
    }
  }

  if (action.type === 'redo') {
    if (state.future.length === 0) return state
    const next = state.future[0]
    const future = state.future.slice(1)
    const past = [...state.past, snapshotOf(state.present)]
    const present = withSnapshot(state.present, next)
    return {
      past,
      present,
      future,
      lastMergeKey: null,
      lastEditAt: null,
    }
  }

  const kind = classify(action)
  const nextPresent = appReducer(state.present, action)

  if (kind.kind === 'reset') {
    return {
      past: [],
      present: nextPresent,
      future: [],
      lastMergeKey: null,
      lastEditAt: null,
    }
  }

  if (kind.kind === 'ui') {
    if (nextPresent === state.present) return state
    return { ...state, present: nextPresent }
  }

  // A document action that turned out to be a no-op (e.g. moveSelection with
  // an empty selection) shouldn't poison the undo stack.
  if (nextPresent === state.present) return state

  // Document edit. Decide whether to coalesce with the previous entry.
  const t = now()
  const canMerge =
    state.lastMergeKey === kind.mergeKey &&
    state.lastEditAt !== null &&
    t - state.lastEditAt <= HISTORY_IDLE_GAP_MS

  if (canMerge) {
    return {
      past: state.past,
      present: nextPresent,
      future: [],
      lastMergeKey: kind.mergeKey,
      lastEditAt: t,
    }
  }

  let past = [...state.past, snapshotOf(state.present)]
  if (past.length > HISTORY_DEPTH_CAP) {
    past = past.slice(past.length - HISTORY_DEPTH_CAP)
  }
  return {
    past,
    present: nextPresent,
    future: [],
    lastMergeKey: kind.mergeKey,
    lastEditAt: t,
  }
}
