import { describe, it, expect } from 'vitest'
import { appReducer, initialState } from './reducer'

describe('createWall', () => {
  it('adds a wall with the given dimensions and makes it the active wall', () => {
    const state = appReducer(initialState, {
      type: 'createWall',
      id: 'w1',
      widthCm: 400,
      heightCm: 300,
    })

    expect(state.walls).toHaveLength(1)
    expect(state.walls[0]).toMatchObject({ id: 'w1', widthCm: 400, heightCm: 300 })
    expect(state.ui.activeWallId).toBe('w1')
  })

  it('defaults a new wall to 800 x 250 cm when dimensions are omitted', () => {
    const state = appReducer(initialState, { type: 'createWall', id: 'w1' })

    expect(state.walls[0]).toMatchObject({ widthCm: 800, heightCm: 250 })
  })

  it('auto-names walls sequentially when no name is given', () => {
    const first = appReducer(initialState, { type: 'createWall', id: 'w1' })
    const second = appReducer(first, { type: 'createWall', id: 'w2' })

    expect(first.walls[0].name).toBe('Wall 1')
    expect(second.walls[1].name).toBe('Wall 2')
  })
})

describe('hydrate', () => {
  it('replaces the entire state with the loaded state', () => {
    const loaded = appReducer(initialState, { type: 'createWall', id: 'saved' })

    const result = appReducer(initialState, { type: 'hydrate', state: loaded })

    expect(result).toEqual(loaded)
  })
})

describe('selectWall', () => {
  it('sets the active wall to the given id', () => {
    const a = appReducer(initialState, { type: 'createWall', id: 'w1' })
    const b = appReducer(a, { type: 'createWall', id: 'w2' })

    expect(b.ui.activeWallId).toBe('w2')

    const c = appReducer(b, { type: 'selectWall', id: 'w1' })
    expect(c.ui.activeWallId).toBe('w1')
  })
})

describe('renameWall', () => {
  it('changes the name of the wall with the matching id', () => {
    const a = appReducer(initialState, { type: 'createWall', id: 'w1' })

    const b = appReducer(a, { type: 'renameWall', id: 'w1', name: 'North Wall' })

    expect(b.walls[0].name).toBe('North Wall')
  })

  it('leaves other walls unchanged', () => {
    const a = appReducer(initialState, { type: 'createWall', id: 'w1' })
    const b = appReducer(a, { type: 'createWall', id: 'w2' })

    const c = appReducer(b, { type: 'renameWall', id: 'w2', name: 'East' })

    expect(c.walls[0].name).toBe('Wall 1')
    expect(c.walls[1].name).toBe('East')
  })
})

describe('resizeWall', () => {
  it('updates width and height for the matching wall', () => {
    const a = appReducer(initialState, { type: 'createWall', id: 'w1' })

    const b = appReducer(a, {
      type: 'resizeWall',
      id: 'w1',
      widthCm: 600,
      heightCm: 200,
    })

    expect(b.walls[0]).toMatchObject({ widthCm: 600, heightCm: 200 })
  })

  it("leaves placements' cm positions unchanged so out-of-bounds photos remain visible in the margin", () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      placements: [
        {
          id: 'p1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 700,
          yCm: 200,
          longEdgeCm: 40,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const shrunk = appReducer(seeded, {
      type: 'resizeWall',
      id: 'w1',
      widthCm: 400,
      heightCm: 150,
    })

    expect(shrunk.placements[0]).toMatchObject({ xCm: 700, yCm: 200 })
  })
})

describe('addPhoto', () => {
  it('adds a photo to the tray', () => {
    const state = appReducer(initialState, {
      type: 'addPhoto',
      id: 'photo-1',
      filename: 'cat.jpg',
      blobKey: 'blob-1',
      aspectRatio: 1.5,
    })

    expect(state.photos).toHaveLength(1)
    expect(state.photos[0]).toMatchObject({
      id: 'photo-1',
      filename: 'cat.jpg',
      blobKey: 'blob-1',
      aspectRatio: 1.5,
    })
  })

  it('appends photos so the tray is ordered by insertion', () => {
    const a = appReducer(initialState, {
      type: 'addPhoto',
      id: 'p1',
      filename: 'a.jpg',
      blobKey: 'b1',
      aspectRatio: 1,
    })
    const b = appReducer(a, {
      type: 'addPhoto',
      id: 'p2',
      filename: 'b.jpg',
      blobKey: 'b2',
      aspectRatio: 2,
    })

    expect(b.photos.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('shares the tray across walls (photos are not scoped to a wall)', () => {
    const withWalls = appReducer(
      appReducer(initialState, { type: 'createWall', id: 'w1' }),
      { type: 'createWall', id: 'w2' },
    )

    const after = appReducer(withWalls, {
      type: 'addPhoto',
      id: 'p1',
      filename: 'a.jpg',
      blobKey: 'b1',
      aspectRatio: 1,
    })

    // Photo is in the global tray, not tied to either wall.
    expect(after.photos).toHaveLength(1)
    expect(after.walls).toHaveLength(2)
  })
})

describe('placePhoto', () => {
  it('creates a placement at the default A3 long edge (42 cm) on the given wall', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1.5 },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'placePhoto',
      id: 'pl-1',
      photoId: 'photo-1',
      wallId: 'w1',
      xCm: 100,
      yCm: 80,
    })

    expect(after.placements).toHaveLength(1)
    expect(after.placements[0]).toMatchObject({
      id: 'pl-1',
      photoId: 'photo-1',
      wallId: 'w1',
      xCm: 100,
      yCm: 80,
      longEdgeCm: 42,
    })
  })

  it('selects the newly placed photo', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1.5 },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'placePhoto',
      id: 'pl-1',
      photoId: 'photo-1',
      wallId: 'w1',
      xCm: 100,
      yCm: 80,
    })

    expect(after.ui.selectedPlacementIds).toEqual(['pl-1'])
  })
})

describe('movePlacement', () => {
  it('updates xCm and yCm of the matching placement', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'movePlacement',
      id: 'pl-1',
      xCm: 250,
      yCm: 120,
    })

    expect(after.placements[0]).toMatchObject({ xCm: 250, yCm: 120 })
  })

  it('leaves other placements unchanged', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
        {
          id: 'pl-2',
          photoId: 'photo-2',
          wallId: 'w1',
          xCm: 200,
          yCm: 90,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'movePlacement',
      id: 'pl-1',
      xCm: 300,
      yCm: 150,
    })

    expect(after.placements[1]).toMatchObject({ xCm: 200, yCm: 90 })
  })
})

describe('resizePlacement', () => {
  it('updates longEdgeCm of the matching placement', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'resizePlacement',
      id: 'pl-1',
      longEdgeCm: 59.4,
    })

    expect(after.placements[0]).toMatchObject({ longEdgeCm: 59.4 })
  })

  it('leaves other placements unchanged', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
        {
          id: 'pl-2',
          photoId: 'photo-2',
          wallId: 'w1',
          xCm: 200,
          yCm: 90,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'resizePlacement',
      id: 'pl-1',
      longEdgeCm: 21,
    })

    expect(after.placements[1]).toMatchObject({ longEdgeCm: 42 })
  })

  it('does not change xCm/yCm', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'resizePlacement',
      id: 'pl-1',
      longEdgeCm: 84.1,
    })

    expect(after.placements[0]).toMatchObject({ xCm: 100, yCm: 80 })
  })
})

describe('selectPlacement', () => {
  it('sets selection to exactly the given id (collapses any prior selection)', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      ui: { activeWallId: 'w1', selectedPlacementIds: ['old-1', 'old-2'], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'selectPlacement', id: 'pl-1' })

    expect(after.ui.selectedPlacementIds).toEqual(['pl-1'])
  })

  it('clearSelection empties the selection set', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      ui: { activeWallId: 'w1', selectedPlacementIds: ['pl-1', 'pl-2'], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'clearSelection' })

    expect(after.ui.selectedPlacementIds).toEqual([])
  })
})

describe('movePlacement (parking)', () => {
  it('accepts positions outside the wall bounds so a placement can be parked in the margin', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'movePlacement',
      id: 'pl-1',
      xCm: -50,
      yCm: 400,
    })

    expect(after.placements[0]).toMatchObject({ xCm: -50, yCm: 400 })
  })
})

describe('sendPlacementToTray', () => {
  it('removes the matching placement and leaves the photo in the tray', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: ['pl-1'], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'sendPlacementToTray', id: 'pl-1' })

    expect(after.placements).toHaveLength(0)
    expect(after.photos).toEqual(seeded.photos)
  })

  it('clears selection if the sent placement was selected', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: ['pl-1'], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'sendPlacementToTray', id: 'pl-1' })

    expect(after.ui.selectedPlacementIds).toEqual([])
  })

  it('leaves other placements of the same photo intact', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
      ],
      walls: [
        { id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 },
        { id: 'w2', name: 'Wall 2', widthCm: 500, heightCm: 300 },
      ],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
        {
          id: 'pl-2',
          photoId: 'photo-1',
          wallId: 'w2',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'sendPlacementToTray', id: 'pl-1' })

    expect(after.placements).toHaveLength(1)
    expect(after.placements[0].id).toBe('pl-2')
  })
})

describe('deletePhoto', () => {
  it('removes the photo and all its placements across walls', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
        { id: 'photo-2', filename: 'b.jpg', blobKey: 'b2', aspectRatio: 1 },
      ],
      walls: [
        { id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 },
        { id: 'w2', name: 'Wall 2', widthCm: 500, heightCm: 300 },
      ],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 10,
          yCm: 10,
          longEdgeCm: 42,
        },
        {
          id: 'pl-2',
          photoId: 'photo-1',
          wallId: 'w2',
          xCm: 10,
          yCm: 10,
          longEdgeCm: 42,
        },
        {
          id: 'pl-3',
          photoId: 'photo-2',
          wallId: 'w1',
          xCm: 10,
          yCm: 10,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'deletePhoto', id: 'photo-1' })

    expect(after.photos.map((p) => p.id)).toEqual(['photo-2'])
    expect(after.placements.map((p) => p.id)).toEqual(['pl-3'])
  })

  it('clears selection if a placement of the deleted photo was selected', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 10,
          yCm: 10,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: ['pl-1'], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'deletePhoto', id: 'photo-1' })

    expect(after.ui.selectedPlacementIds).toEqual([])
  })
})

describe('deleteWall', () => {
  it('removes the wall with the given id', () => {
    const a = appReducer(initialState, { type: 'createWall', id: 'w1' })
    const b = appReducer(a, { type: 'createWall', id: 'w2' })

    const c = appReducer(b, { type: 'deleteWall', id: 'w1' })

    expect(c.walls).toHaveLength(1)
    expect(c.walls[0].id).toBe('w2')
  })

  it('removes placements that belonged to the deleted wall', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [
        { id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 },
        { id: 'w2', name: 'Wall 2', widthCm: 800, heightCm: 250 },
      ],
      placements: [
        { id: 'p1', photoId: 'ph1', wallId: 'w1', xCm: 10, yCm: 10, longEdgeCm: 40 },
        { id: 'p2', photoId: 'ph2', wallId: 'w2', xCm: 10, yCm: 10, longEdgeCm: 40 },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'deleteWall', id: 'w1' })

    expect(after.placements).toHaveLength(1)
    expect(after.placements[0].id).toBe('p2')
  })

  it('promotes another wall to active when the active wall is deleted', () => {
    const a = appReducer(initialState, { type: 'createWall', id: 'w1' })
    const b = appReducer(a, { type: 'createWall', id: 'w2' })
    // w2 is active after creation
    const c = appReducer(b, { type: 'deleteWall', id: 'w2' })

    expect(c.ui.activeWallId).toBe('w1')
  })

  it('sets active wall to null when the last wall is deleted', () => {
    const a = appReducer(initialState, { type: 'createWall', id: 'w1' })

    const b = appReducer(a, { type: 'deleteWall', id: 'w1' })

    expect(b.walls).toHaveLength(0)
    expect(b.ui.activeWallId).toBeNull()
  })
})

describe('overlay toggles', () => {
  it('initialState defaults ruler and silhouette overlays to on', () => {
    expect(initialState.ui.rulerEnabled).toBe(true)
    expect(initialState.ui.silhouetteEnabled).toBe(true)
  })

  it('toggleRuler flips rulerEnabled and leaves silhouetteEnabled alone', () => {
    const a = appReducer(initialState, { type: 'toggleRuler' })
    expect(a.ui.rulerEnabled).toBe(false)
    expect(a.ui.silhouetteEnabled).toBe(true)

    const b = appReducer(a, { type: 'toggleRuler' })
    expect(b.ui.rulerEnabled).toBe(true)
  })

  it('toggleSilhouette flips silhouetteEnabled and leaves rulerEnabled alone', () => {
    const a = appReducer(initialState, { type: 'toggleSilhouette' })
    expect(a.ui.silhouetteEnabled).toBe(false)
    expect(a.ui.rulerEnabled).toBe(true)

    const b = appReducer(a, { type: 'toggleSilhouette' })
    expect(b.ui.silhouetteEnabled).toBe(true)
  })

  it('hydrate fills missing overlay flags with defaults (backwards compat)', () => {
    const legacy = {
      ...initialState,
      ui: { activeWallId: null, selectedPlacementIds: [] },
      // No rulerEnabled / silhouetteEnabled in older snapshots.
    } as unknown as Parameters<typeof appReducer>[0]

    const after = appReducer(initialState, { type: 'hydrate', state: legacy })

    expect(after.ui.rulerEnabled).toBe(true)
    expect(after.ui.silhouetteEnabled).toBe(true)
  })
})

describe('multi-select', () => {
  const seeded = (selected: string[]): ReturnType<typeof appReducer> => ({
    ...initialState,
    walls: [
      { id: 'w1', name: 'W1', widthCm: 800, heightCm: 250 },
      { id: 'w2', name: 'W2', widthCm: 800, heightCm: 250 },
    ],
    placements: [
      { id: 'pl-1', photoId: 'ph-1', wallId: 'w1', xCm: 100, yCm: 80, longEdgeCm: 42 },
      { id: 'pl-2', photoId: 'ph-2', wallId: 'w1', xCm: 200, yCm: 80, longEdgeCm: 42 },
      { id: 'pl-3', photoId: 'ph-3', wallId: 'w1', xCm: 300, yCm: 80, longEdgeCm: 42 },
    ],
    ui: { activeWallId: 'w1', selectedPlacementIds: selected, rulerEnabled: true, silhouetteEnabled: true },
  })

  it('selectPlacement collapses to a single id when others were selected', () => {
    const after = appReducer(seeded(['pl-1', 'pl-2']), { type: 'selectPlacement', id: 'pl-3' })
    expect(after.ui.selectedPlacementIds).toEqual(['pl-3'])
  })

  it('toggleSelectPlacement adds an id when not in the set', () => {
    const after = appReducer(seeded(['pl-1']), { type: 'toggleSelectPlacement', id: 'pl-2' })
    expect(after.ui.selectedPlacementIds).toEqual(['pl-1', 'pl-2'])
  })

  it('toggleSelectPlacement removes an id when already in the set', () => {
    const after = appReducer(seeded(['pl-1', 'pl-2']), { type: 'toggleSelectPlacement', id: 'pl-1' })
    expect(after.ui.selectedPlacementIds).toEqual(['pl-2'])
  })

  it('selectWall clears the selection (selection is per-wall)', () => {
    const after = appReducer(seeded(['pl-1', 'pl-2']), { type: 'selectWall', id: 'w2' })
    expect(after.ui.activeWallId).toBe('w2')
    expect(after.ui.selectedPlacementIds).toEqual([])
  })

  it('moveSelection shifts every selected placement by the same delta, leaving others alone', () => {
    const after = appReducer(seeded(['pl-1', 'pl-3']), {
      type: 'moveSelection',
      dxCm: 10,
      dyCm: -5,
    })
    expect(after.placements.find((p) => p.id === 'pl-1')).toMatchObject({ xCm: 110, yCm: 75 })
    expect(after.placements.find((p) => p.id === 'pl-3')).toMatchObject({ xCm: 310, yCm: 75 })
    // pl-2 was unselected — unchanged.
    expect(after.placements.find((p) => p.id === 'pl-2')).toMatchObject({ xCm: 200, yCm: 80 })
  })

  it('deleteSelection removes every selected placement and clears the selection', () => {
    const after = appReducer(seeded(['pl-1', 'pl-3']), { type: 'deleteSelection' })
    expect(after.placements.map((p) => p.id)).toEqual(['pl-2'])
    expect(after.ui.selectedPlacementIds).toEqual([])
  })

  it('sendSelectionToTray removes every selected placement and clears the selection', () => {
    const after = appReducer(seeded(['pl-1', 'pl-3']), { type: 'sendSelectionToTray' })
    expect(after.placements.map((p) => p.id)).toEqual(['pl-2'])
    expect(after.ui.selectedPlacementIds).toEqual([])
  })

  it('hydrate of a legacy snapshot with selectedPlacementId lifts it to a single-id set', () => {
    const legacy = {
      ...initialState,
      ui: { activeWallId: 'w1', selectedPlacementId: 'pl-legacy', rulerEnabled: true, silhouetteEnabled: true },
    } as unknown as Parameters<typeof appReducer>[0]

    const after = appReducer(initialState, { type: 'hydrate', state: legacy })

    expect(after.ui.selectedPlacementIds).toEqual(['pl-legacy'])
  })
})
