import { describe, it, expect } from 'vitest'
import { appReducer, initialState } from './reducer'
import type { AppState } from './types'
import {
  createHistoryState,
  historyReducer,
  HISTORY_DEPTH_CAP,
} from './history'

/** A deterministic clock that advances on each call. */
function clockFrom(times: number[]): () => number {
  let i = 0
  return () => times[Math.min(i++, times.length - 1)]
}

function seededState(): AppState {
  let s = initialState
  s = appReducer(s, {
    type: 'createWall',
    id: 'w1',
    name: 'Wall 1',
    widthCm: 400,
    heightCm: 300,
  })
  s = appReducer(s, {
    type: 'createWall',
    id: 'w2',
    name: 'Wall 2',
    widthCm: 400,
    heightCm: 300,
  })
  s = appReducer(s, { type: 'selectWall', id: 'w1' })
  s = appReducer(s, {
    type: 'importPhotos',
    items: [
      {
        photoId: 'ph1',
        filename: 'a.jpg',
        blobKey: 'k1',
        aspectRatio: 1.5,
        placementId: 'pl1',
        wallId: 'w1',
        xCm: 100,
        yCm: 100,
      },
    ],
  })
  return s
}

describe('history: push on document action', () => {
  it('pushes the prior present onto past when a document action is dispatched', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000])

    const h1 = historyReducer(
      h0,
      { type: 'movePlacement', id: 'pl1', xCm: 200, yCm: 100 },
      now,
    )

    expect(h1.past).toHaveLength(1)
    expect(h1.present.placements[0]).toMatchObject({ xCm: 200, yCm: 100 })
    expect(h1.future).toEqual([])
  })
})

describe('history: no push on UI-only action', () => {
  it('selectPlacement does not record an undo entry', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000])

    const h1 = historyReducer(
      h0,
      { type: 'selectPlacement', id: 'pl1' },
      now,
    )

    expect(h1.past).toHaveLength(0)
    expect(h1.present.ui.selectedPlacementIds).toEqual(['pl1'])
  })

  it('selectWall, toggleSelectPlacement, clearSelection, toggleRuler, toggleSilhouette are not recorded', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = () => 0

    const after = [
      { type: 'selectWall', id: 'w2' } as const,
      { type: 'toggleSelectPlacement', id: 'pl1' } as const,
      { type: 'clearSelection' } as const,
      { type: 'toggleRuler' } as const,
      { type: 'toggleSilhouette' } as const,
    ].reduce((h, action) => historyReducer(h, action, now), h0)

    expect(after.past).toHaveLength(0)
  })
})

describe('history: undo restores document and active wall', () => {
  it('undo restores walls/photos/placements and activeWallId from the snapshot at the time of edit', () => {
    const initial = seededState() // activeWallId = w1
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000, 2000])

    // Make an edit on w1, then switch to w2 (UI-only).
    const h1 = historyReducer(
      h0,
      { type: 'movePlacement', id: 'pl1', xCm: 250, yCm: 50 },
      now,
    )
    const h2 = historyReducer(h1, { type: 'selectWall', id: 'w2' }, now)
    expect(h2.present.ui.activeWallId).toBe('w2')

    const h3 = historyReducer(h2, { type: 'undo' }, now)

    // Document is rolled back...
    expect(h3.present.placements[0]).toMatchObject({ xCm: 100, yCm: 100 })
    // ...and active wall returns to where the edit was made.
    expect(h3.present.ui.activeWallId).toBe('w1')
  })

  it('redo reapplies the change and re-sets the active wall', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000])

    const h1 = historyReducer(
      h0,
      { type: 'movePlacement', id: 'pl1', xCm: 250, yCm: 50 },
      now,
    )
    const h2 = historyReducer(h1, { type: 'undo' }, now)
    const h3 = historyReducer(h2, { type: 'redo' }, now)

    expect(h3.present.placements[0]).toMatchObject({ xCm: 250, yCm: 50 })
    expect(h3.present.ui.activeWallId).toBe('w1')
  })

  it('undo leaves view toggles (ruler/silhouette) untouched', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000, 2000])

    // Document edit, then toggle ruler off.
    const h1 = historyReducer(
      h0,
      { type: 'movePlacement', id: 'pl1', xCm: 250, yCm: 50 },
      now,
    )
    const h2 = historyReducer(h1, { type: 'toggleRuler' }, now)
    expect(h2.present.ui.rulerEnabled).toBe(false)

    const h3 = historyReducer(h2, { type: 'undo' }, now)
    expect(h3.present.ui.rulerEnabled).toBe(false)
  })

  it('undo prunes selection ids that no longer refer to a placement', () => {
    const initial = seededState()
    // Select pl1, then delete the placement (a document action).
    const sel = appReducer(initial, { type: 'selectPlacement', id: 'pl1' })
    const h0 = createHistoryState(sel)
    const now = clockFrom([1000])

    const h1 = historyReducer(h0, { type: 'deleteSelection' }, now)
    expect(h1.present.placements).toHaveLength(0)
    expect(h1.present.ui.selectedPlacementIds).toEqual([])

    // Undo restores the placement; selection should NOT be revived (selection isn't part of history),
    // so it stays empty, but it must remain valid (no dangling ids).
    const h2 = historyReducer(h1, { type: 'undo' }, now)
    expect(h2.present.placements).toHaveLength(1)
    expect(h2.present.ui.selectedPlacementIds).toEqual([])
  })

  it('undo is a no-op when past is empty', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const h1 = historyReducer(h0, { type: 'undo' }, () => 0)
    expect(h1).toBe(h0)
  })

  it('redo is a no-op when future is empty', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const h1 = historyReducer(h0, { type: 'redo' }, () => 0)
    expect(h1).toBe(h0)
  })
})

describe('history: merge-key coalescing', () => {
  it('consecutive same-merge-key edits within the idle gap collapse into a single undo step', () => {
    // setPlacementSize uses merge key setPlacementSize:<id>.
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000, 1050, 1100])

    const h1 = historyReducer(
      h0,
      { type: 'setPlacementSize', id: 'pl1', size: { mode: 'aspect', longEdgeCm: 30 } },
      now,
    )
    const h2 = historyReducer(
      h1,
      { type: 'setPlacementSize', id: 'pl1', size: { mode: 'aspect', longEdgeCm: 40 } },
      now,
    )
    const h3 = historyReducer(
      h2,
      { type: 'setPlacementSize', id: 'pl1', size: { mode: 'aspect', longEdgeCm: 50 } },
      now,
    )

    expect(h3.past).toHaveLength(1)
    const finalSize = h3.present.placements[0].size
    expect(finalSize.mode === 'aspect' && finalSize.longEdgeCm).toBe(50)

    // Single undo returns to the pre-resize value (42 = DEFAULT).
    const undone = historyReducer(h3, { type: 'undo' }, () => 0)
    const undoneSize = undone.present.placements[0].size
    expect(undoneSize.mode === 'aspect' && undoneSize.longEdgeCm).toBe(42)
  })

  it('a different merge key starts a new undo step', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000, 1050])

    const h1 = historyReducer(
      h0,
      { type: 'setPlacementSize', id: 'pl1', size: { mode: 'aspect', longEdgeCm: 30 } },
      now,
    )
    const h2 = historyReducer(
      h1,
      { type: 'movePlacement', id: 'pl1', xCm: 200, yCm: 100 },
      now,
    )

    expect(h2.past).toHaveLength(2)
  })

  it('an idle gap larger than the threshold starts a new undo step even with the same merge key', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    // 1000, then 5000 (4s gap > 500ms threshold)
    const now = clockFrom([1000, 5000])

    const h1 = historyReducer(
      h0,
      { type: 'setPlacementSize', id: 'pl1', size: { mode: 'aspect', longEdgeCm: 30 } },
      now,
    )
    const h2 = historyReducer(
      h1,
      { type: 'setPlacementSize', id: 'pl1', size: { mode: 'aspect', longEdgeCm: 40 } },
      now,
    )

    expect(h2.past).toHaveLength(2)
  })
})

describe('history: redo clearing', () => {
  it('a new document edit after an undo clears the redo stack', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000, 2000, 3000])

    const h1 = historyReducer(
      h0,
      { type: 'movePlacement', id: 'pl1', xCm: 200, yCm: 100 },
      now,
    )
    const h2 = historyReducer(h1, { type: 'undo' }, now)
    expect(h2.future).toHaveLength(1)

    const h3 = historyReducer(
      h2,
      { type: 'movePlacement', id: 'pl1', xCm: 300, yCm: 100 },
      now,
    )
    expect(h3.future).toEqual([])
    expect(h3.past).toHaveLength(1)
  })

  it('a UI-only action after an undo does NOT clear the redo stack', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000])

    const h1 = historyReducer(
      h0,
      { type: 'movePlacement', id: 'pl1', xCm: 200, yCm: 100 },
      now,
    )
    const h2 = historyReducer(h1, { type: 'undo' }, now)
    const h3 = historyReducer(
      h2,
      { type: 'selectPlacement', id: 'pl1' },
      now,
    )
    expect(h3.future).toHaveLength(1)
  })
})

describe('history: no-op document actions', () => {
  it('a document action that did not change the state does not push an undo entry', () => {
    // Start from an empty-selection state so moveSelection / deleteSelection are no-ops.
    const initial = appReducer(seededState(), { type: 'clearSelection' })
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000, 2000])

    const h1 = historyReducer(h0, { type: 'deleteSelection' }, now)
    const h2 = historyReducer(
      h1,
      { type: 'moveSelection', dxCm: 10, dyCm: 0 },
      now,
    )

    expect(h1).toBe(h0)
    expect(h2).toBe(h0)
  })
})

describe('history: depth cap', () => {
  it('drops the oldest past entry when the cap is exceeded', () => {
    const initial = seededState()
    let h = createHistoryState(initial)
    // each call uses a new time so coalescing never kicks in
    let t = 1000
    const now = () => {
      t += 10_000
      return t
    }

    for (let i = 0; i < HISTORY_DEPTH_CAP + 5; i++) {
      h = historyReducer(
        h,
        { type: 'movePlacement', id: 'pl1', xCm: 100 + i, yCm: 100 },
        now,
      )
    }
    expect(h.past).toHaveLength(HISTORY_DEPTH_CAP)
  })
})

describe('history: hydrate and import reset', () => {
  it('hydrate clears past and future', () => {
    const initial = seededState()
    const h0 = createHistoryState(initial)
    const now = clockFrom([1000, 2000])

    const h1 = historyReducer(
      h0,
      { type: 'movePlacement', id: 'pl1', xCm: 200, yCm: 100 },
      now,
    )
    const h2 = historyReducer(h1, { type: 'undo' }, now)
    expect(h2.past).toHaveLength(0)
    expect(h2.future).toHaveLength(1)

    const fresh = seededState()
    const h3 = historyReducer(h2, { type: 'hydrate', state: fresh }, now)
    expect(h3.past).toEqual([])
    expect(h3.future).toEqual([])
    expect(h3.present).toEqual(fresh)
  })
})
