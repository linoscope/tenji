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
          size: { mode: 'aspect' as const, longEdgeCm: 40 },
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

describe('importPhotos', () => {
  it('adds each item as a photo + a placement at the given (xCm, yCm) on the given wall', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 }],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'importPhotos',
      items: [
        {
          photoId: 'p1',
          filename: 'a.jpg',
          blobKey: 'b1',
          aspectRatio: 1,
          placementId: 'pl-1',
          wallId: 'w1',
          xCm: 250,
          yCm: 340, // in margin
        },
        {
          photoId: 'p2',
          filename: 'b.jpg',
          blobKey: 'b2',
          aspectRatio: 1.5,
          placementId: 'pl-2',
          wallId: 'w1',
          xCm: 300,
          yCm: 340,
        },
      ],
    })

    expect(after.photos.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(after.placements.map((p) => p.id)).toEqual(['pl-1', 'pl-2'])
    expect(after.placements[0]).toMatchObject({
      photoId: 'p1',
      wallId: 'w1',
      xCm: 250,
      yCm: 340,
      size: { mode: 'aspect' as const, longEdgeCm: 42 },
    })
    expect(after.placements[1]).toMatchObject({
      photoId: 'p2',
      wallId: 'w1',
      xCm: 300,
      yCm: 340,
    })
  })

  it('selects the newly imported placements', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 }],
      ui: { activeWallId: 'w1', selectedPlacementIds: ['pl-existing'], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'importPhotos',
      items: [
        {
          photoId: 'p1',
          filename: 'a.jpg',
          blobKey: 'b1',
          aspectRatio: 1,
          placementId: 'pl-new',
          wallId: 'w1',
          xCm: 250,
          yCm: 340,
        },
      ],
    })

    expect(after.ui.selectedPlacementIds).toEqual(['pl-new'])
  })

  it('appends to existing photos/placements rather than replacing them', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 }],
      photos: [
        { id: 'p-old', filename: 'old.jpg', blobKey: 'b-old', aspectRatio: 1 },
      ],
      placements: [
        { id: 'pl-old', photoId: 'p-old', wallId: 'w1', xCm: 100, yCm: 100, size: { mode: 'aspect' as const, longEdgeCm: 42 } },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'importPhotos',
      items: [
        {
          photoId: 'p-new',
          filename: 'new.jpg',
          blobKey: 'b-new',
          aspectRatio: 1,
          placementId: 'pl-new',
          wallId: 'w1',
          xCm: 250,
          yCm: 340,
        },
      ],
    })

    expect(after.photos.map((p) => p.id)).toEqual(['p-old', 'p-new'])
    expect(after.placements.map((p) => p.id)).toEqual(['pl-old', 'pl-new'])
  })

  it('is a no-op when items is empty', () => {
    const seeded: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 500, heightCm: 300 }],
      ui: { activeWallId: 'w1', selectedPlacementIds: ['pl-existing'], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'importPhotos', items: [] })

    expect(after).toBe(seeded)
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
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
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
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
        },
        {
          id: 'pl-2',
          photoId: 'photo-2',
          wallId: 'w1',
          xCm: 200,
          yCm: 90,
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
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

describe('setPlacementSize', () => {
  it('updates size of the matching placement', () => {
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
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'setPlacementSize',
      id: 'pl-1',
      size: { mode: 'aspect' as const, longEdgeCm: 59.4 },
    })

    expect(after.placements[0]).toMatchObject({ size: { mode: 'aspect' as const, longEdgeCm: 59.4 } })
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
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
        },
        {
          id: 'pl-2',
          photoId: 'photo-2',
          wallId: 'w1',
          xCm: 200,
          yCm: 90,
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'setPlacementSize',
      id: 'pl-1',
      size: { mode: 'aspect' as const, longEdgeCm: 21 },
    })

    expect(after.placements[1]).toMatchObject({ size: { mode: 'aspect' as const, longEdgeCm: 42 } })
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
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'setPlacementSize',
      id: 'pl-1',
      size: { mode: 'aspect' as const, longEdgeCm: 84.1 },
    })

    expect(after.placements[0]).toMatchObject({ xCm: 100, yCm: 80 })
  })

  it('switches mode to crop with explicit width/height', () => {
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
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'setPlacementSize',
      id: 'pl-1',
      size: { mode: 'crop' as const, widthCm: 30, heightCm: 40 },
    })

    expect(after.placements[0].size).toEqual({ mode: 'crop' as const, widthCm: 30, heightCm: 40 })
  })
})

describe('swapPlacementCropOrientation', () => {
  const cropPlacement = (size: { mode: 'crop'; widthCm: number; heightCm: number }) => ({
    ...initialState,
    walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
    placements: [
      {
        id: 'pl-1',
        photoId: 'photo-1',
        wallId: 'w1',
        xCm: 100,
        yCm: 80,
        size,
      },
    ],
    ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
  })

  it('swaps widthCm and heightCm on a crop placement', () => {
    const seeded = cropPlacement({ mode: 'crop' as const, widthCm: 42, heightCm: 29.7 })

    const after = appReducer(seeded, {
      type: 'swapPlacementCropOrientation',
      id: 'pl-1',
    })

    expect(after.placements[0].size).toEqual({
      mode: 'crop' as const,
      widthCm: 29.7,
      heightCm: 42,
    })
  })

  it('is a no-op for a square crop rectangle', () => {
    const seeded = cropPlacement({ mode: 'crop' as const, widthCm: 30, heightCm: 30 })

    const after = appReducer(seeded, {
      type: 'swapPlacementCropOrientation',
      id: 'pl-1',
    })

    expect(after.placements[0].size).toEqual({ mode: 'crop' as const, widthCm: 30, heightCm: 30 })
  })

  it('is a no-op for an aspect placement', () => {
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
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, {
      type: 'swapPlacementCropOrientation',
      id: 'pl-1',
    })

    expect(after.placements[0].size).toEqual({ mode: 'aspect' as const, longEdgeCm: 42 })
  })
})

describe('resizeSelection', () => {
  const seededMixed = () => ({
    ...initialState,
    photos: [
      { id: 'photo-land', filename: 'land.jpg', blobKey: 'b1', aspectRatio: 1.5 },
      { id: 'photo-port', filename: 'port.jpg', blobKey: 'b2', aspectRatio: 2 / 3 },
      { id: 'photo-sq', filename: 'sq.jpg', blobKey: 'b3', aspectRatio: 1 },
    ],
    walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
    placements: [
      // aspect-mode landscape photo
      {
        id: 'pl-aspect',
        photoId: 'photo-land',
        wallId: 'w1',
        xCm: 100,
        yCm: 80,
        size: { mode: 'aspect' as const, longEdgeCm: 21 },
      },
      // crop-mode placement (landscape rect, on a portrait photo)
      {
        id: 'pl-crop',
        photoId: 'photo-port',
        wallId: 'w1',
        xCm: 200,
        yCm: 80,
        size: { mode: 'crop' as const, widthCm: 30, heightCm: 20 },
      },
      // not in selection — must stay untouched
      {
        id: 'pl-other',
        photoId: 'photo-sq',
        wallId: 'w1',
        xCm: 300,
        yCm: 80,
        size: { mode: 'aspect' as const, longEdgeCm: 21 },
      },
    ],
    ui: {
      activeWallId: 'w1',
      selectedPlacementIds: ['pl-aspect', 'pl-crop'],
      rulerEnabled: true,
      silhouetteEnabled: true,
    },
  })

  it('applies a preset to every id in the selection, honoring per-placement mode', () => {
    const seeded = seededMixed()
    const after = appReducer(seeded, {
      type: 'resizeSelection',
      ids: ['pl-aspect', 'pl-crop'],
      choice: { kind: 'preset', longEdgeCm: 42 },
    })

    // Aspect placement: long edge set to 42, still aspect mode.
    const aspect = after.placements.find((p) => p.id === 'pl-aspect')!
    expect(aspect.size).toEqual({ mode: 'aspect' as const, longEdgeCm: 42 })

    // Crop placement: paper rect oriented to the photo (portrait, 2/3 ratio) → 28×42.
    const crop = after.placements.find((p) => p.id === 'pl-crop')!
    expect(crop.size.mode).toBe('crop')
    if (crop.size.mode !== 'crop') throw new Error('expected crop')
    expect(crop.size.widthCm).toBeCloseTo(28)
    expect(crop.size.heightCm).toBeCloseTo(42)
  })

  it('applies a custom long edge to every id, scaling crop rectangles by ratio', () => {
    const seeded = seededMixed()
    const after = appReducer(seeded, {
      type: 'resizeSelection',
      ids: ['pl-aspect', 'pl-crop'],
      choice: { kind: 'custom', longEdgeCm: 60 },
    })

    // Aspect placement: long edge set to 60.
    const aspect = after.placements.find((p) => p.id === 'pl-aspect')!
    expect(aspect.size).toEqual({ mode: 'aspect' as const, longEdgeCm: 60 })

    // Crop placement: 30×20 (landscape) scaled so long edge = 60 → 60×40.
    const crop = after.placements.find((p) => p.id === 'pl-crop')!
    expect(crop.size).toEqual({
      mode: 'crop' as const,
      widthCm: 60,
      heightCm: 40,
    })
  })

  it('leaves placements not in `ids` untouched', () => {
    const seeded = seededMixed()
    const after = appReducer(seeded, {
      type: 'resizeSelection',
      ids: ['pl-aspect', 'pl-crop'],
      choice: { kind: 'preset', longEdgeCm: 84.1 },
    })

    const other = after.placements.find((p) => p.id === 'pl-other')!
    expect(other.size).toEqual({ mode: 'aspect' as const, longEdgeCm: 21 })
  })

  it('never changes a placement’s aspect↔crop mode', () => {
    const seeded = seededMixed()
    const after = appReducer(seeded, {
      type: 'resizeSelection',
      ids: ['pl-aspect', 'pl-crop'],
      choice: { kind: 'preset', longEdgeCm: 42 },
    })

    expect(after.placements.find((p) => p.id === 'pl-aspect')!.size.mode).toBe(
      'aspect',
    )
    expect(after.placements.find((p) => p.id === 'pl-crop')!.size.mode).toBe(
      'crop',
    )
  })

  it('is a no-op when ids is empty', () => {
    const seeded = seededMixed()
    const after = appReducer(seeded, {
      type: 'resizeSelection',
      ids: [],
      choice: { kind: 'preset', longEdgeCm: 42 },
    })

    expect(after).toBe(seeded)
  })

  it('skips ids that do not match any placement', () => {
    const seeded = seededMixed()
    const after = appReducer(seeded, {
      type: 'resizeSelection',
      ids: ['nonexistent'],
      choice: { kind: 'preset', longEdgeCm: 42 },
    })

    // No placement should change.
    expect(after.placements).toEqual(seeded.placements)
  })
})

describe('migratePlacementSize', () => {
  it('hydrate migrates legacy placements with longEdgeCm to aspect mode', () => {
    const legacy = {
      ...initialState,
      walls: [{ id: 'w1', name: 'Wall 1', widthCm: 800, heightCm: 250 }],
      placements: [
        {
          id: 'pl-old',
          photoId: 'p1',
          wallId: 'w1',
          xCm: 100,
          yCm: 80,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
    } as unknown as Parameters<typeof appReducer>[0]

    const after = appReducer(initialState, { type: 'hydrate', state: legacy })

    expect(after.placements[0].size).toEqual({ mode: 'aspect' as const, longEdgeCm: 42 })
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
          size: { mode: 'aspect' as const, longEdgeCm: 42 },
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

describe('deleteSelection (instance-level)', () => {
  it('removes only the selected placement and leaves the photo + other placements intact', () => {
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
        { id: 'pl-1', photoId: 'photo-1', wallId: 'w1', xCm: 100, yCm: 80, size: { mode: 'aspect' as const, longEdgeCm: 42 } },
        { id: 'pl-2', photoId: 'photo-1', wallId: 'w2', xCm: 100, yCm: 80, size: { mode: 'aspect' as const, longEdgeCm: 42 } },
      ],
      ui: { activeWallId: 'w1', selectedPlacementIds: ['pl-1'], rulerEnabled: true, silhouetteEnabled: true },
    }

    const after = appReducer(seeded, { type: 'deleteSelection' })

    // pl-1 removed, pl-2 (same photo, other wall) untouched.
    expect(after.placements.map((p) => p.id)).toEqual(['pl-2'])
    // The photo metadata is preserved — its blob may stay in storage.
    expect(after.photos.map((p) => p.id)).toEqual(['photo-1'])
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
        { id: 'p1', photoId: 'ph1', wallId: 'w1', xCm: 10, yCm: 10, size: { mode: 'aspect' as const, longEdgeCm: 40 } },
        { id: 'p2', photoId: 'ph2', wallId: 'w2', xCm: 10, yCm: 10, size: { mode: 'aspect' as const, longEdgeCm: 40 } },
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
      { id: 'pl-1', photoId: 'ph-1', wallId: 'w1', xCm: 100, yCm: 80, size: { mode: 'aspect' as const, longEdgeCm: 42 } },
      { id: 'pl-2', photoId: 'ph-2', wallId: 'w1', xCm: 200, yCm: 80, size: { mode: 'aspect' as const, longEdgeCm: 42 } },
      { id: 'pl-3', photoId: 'ph-3', wallId: 'w1', xCm: 300, yCm: 80, size: { mode: 'aspect' as const, longEdgeCm: 42 } },
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

  it('setSelection replaces the selection with the given ids, deduped', () => {
    const after = appReducer(seeded(['pl-1']), {
      type: 'setSelection',
      ids: ['pl-2', 'pl-3', 'pl-2'],
    })
    expect(after.ui.selectedPlacementIds).toEqual(['pl-2', 'pl-3'])
  })

  it('setSelection with an empty list clears the selection', () => {
    const after = appReducer(seeded(['pl-1', 'pl-2']), {
      type: 'setSelection',
      ids: [],
    })
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

describe('pastePlacements', () => {
  const seeded = (): ReturnType<typeof appReducer> => ({
    ...initialState,
    photos: [
      { id: 'ph-a', filename: 'a.jpg', blobKey: 'b-a', aspectRatio: 1 },
      { id: 'ph-b', filename: 'b.jpg', blobKey: 'b-b', aspectRatio: 1 },
    ],
    walls: [
      { id: 'w1', name: 'W1', widthCm: 800, heightCm: 250 },
      { id: 'w2', name: 'W2', widthCm: 800, heightCm: 250 },
    ],
    placements: [
      { id: 'pl-1', photoId: 'ph-a', wallId: 'w1', xCm: 100, yCm: 80, size: { mode: 'aspect' as const, longEdgeCm: 30 } },
    ],
    ui: { activeWallId: 'w2', selectedPlacementIds: [], rulerEnabled: true, silhouetteEnabled: true },
  })

  it('creates fresh placement instances on the named wall referencing the same photos', () => {
    const after = appReducer(seeded(), {
      type: 'pastePlacements',
      items: [
        { placementId: 'pl-new-a', photoId: 'ph-a', wallId: 'w2', xCm: 50, yCm: 60, size: { mode: 'aspect' as const, longEdgeCm: 30 } },
        { placementId: 'pl-new-b', photoId: 'ph-b', wallId: 'w2', xCm: 150, yCm: 60, size: { mode: 'aspect' as const, longEdgeCm: 40 } },
      ],
    })

    // Originals untouched.
    expect(after.placements.find((p) => p.id === 'pl-1')).toMatchObject({
      photoId: 'ph-a',
      wallId: 'w1',
      xCm: 100,
      yCm: 80,
    })
    // New placements appended in input order.
    expect(after.placements.map((p) => p.id)).toEqual(['pl-1', 'pl-new-a', 'pl-new-b'])
    expect(after.placements[1]).toMatchObject({
      photoId: 'ph-a',
      wallId: 'w2',
      xCm: 50,
      yCm: 60,
      size: { mode: 'aspect' as const, longEdgeCm: 30 },
    })
    expect(after.placements[2]).toMatchObject({
      photoId: 'ph-b',
      wallId: 'w2',
      xCm: 150,
      yCm: 60,
      size: { mode: 'aspect' as const, longEdgeCm: 40 },
    })
  })

  it('does NOT create new photo entries — paste reuses existing photo ids', () => {
    const before = seeded()
    const after = appReducer(before, {
      type: 'pastePlacements',
      items: [
        { placementId: 'pl-new', photoId: 'ph-a', wallId: 'w2', xCm: 50, yCm: 60, size: { mode: 'aspect' as const, longEdgeCm: 30 } },
      ],
    })
    expect(after.photos).toBe(before.photos)
  })

  it('selects the pasted placement ids', () => {
    const after = appReducer(seeded(), {
      type: 'pastePlacements',
      items: [
        { placementId: 'pl-x', photoId: 'ph-a', wallId: 'w2', xCm: 50, yCm: 60, size: { mode: 'aspect' as const, longEdgeCm: 30 } },
        { placementId: 'pl-y', photoId: 'ph-b', wallId: 'w2', xCm: 150, yCm: 60, size: { mode: 'aspect' as const, longEdgeCm: 40 } },
      ],
    })
    expect(after.ui.selectedPlacementIds).toEqual(['pl-x', 'pl-y'])
  })

  it('is a no-op when items is empty', () => {
    const before = seeded()
    const after = appReducer(before, { type: 'pastePlacements', items: [] })
    expect(after).toBe(before)
  })
})

describe('duplicateWall', () => {
  const seeded = (): ReturnType<typeof appReducer> => ({
    ...initialState,
    photos: [
      { id: 'ph-a', filename: 'a.jpg', blobKey: 'b-a', aspectRatio: 1 },
      { id: 'ph-b', filename: 'b.jpg', blobKey: 'b-b', aspectRatio: 1.5 },
    ],
    walls: [
      { id: 'w1', name: 'North', widthCm: 800, heightCm: 250 },
      { id: 'w2', name: 'South', widthCm: 600, heightCm: 220 },
      { id: 'w3', name: 'East', widthCm: 500, heightCm: 200 },
    ],
    placements: [
      // Two on-wall placements on w2 (the one we'll duplicate).
      {
        id: 'pl-1',
        photoId: 'ph-a',
        wallId: 'w2',
        xCm: 100,
        yCm: 80,
        size: { mode: 'aspect' as const, longEdgeCm: 30 },
      },
      {
        id: 'pl-2',
        photoId: 'ph-b',
        wallId: 'w2',
        xCm: 200,
        yCm: 90,
        size: { mode: 'crop' as const, widthCm: 42, heightCm: 28 },
      },
      // One margin-parked placement on w2 (negative xCm => outside the wall).
      {
        id: 'pl-3',
        photoId: 'ph-a',
        wallId: 'w2',
        xCm: -40,
        yCm: 50,
        size: { mode: 'aspect' as const, longEdgeCm: 25 },
      },
      // A placement on w1 — should be untouched by duplicating w2.
      {
        id: 'pl-other',
        photoId: 'ph-a',
        wallId: 'w1',
        xCm: 50,
        yCm: 60,
        size: { mode: 'aspect' as const, longEdgeCm: 20 },
      },
    ],
    ui: {
      activeWallId: 'w1',
      selectedPlacementIds: ['pl-other'],
      rulerEnabled: true,
      silhouetteEnabled: true,
    },
  })
  it('creates a new wall with the same dimensions, named "<name> copy"', () => {
    const after = appReducer(seeded(), {
      type: 'duplicateWall',
      sourceId: 'w2',
      newWallId: 'w2-copy',
      newPlacementIds: ['new-1', 'new-2', 'new-3'],
    })
    const copy = after.walls.find((w) => w.id === 'w2-copy')
    expect(copy).toMatchObject({
      id: 'w2-copy',
      name: 'South copy',
      widthCm: 600,
      heightCm: 220,
    })
  })

  it('clones every placement on the source wall (including margin-parked) with new ids and the new wall id, preserving photo/size/position', () => {
    const after = appReducer(seeded(), {
      type: 'duplicateWall',
      sourceId: 'w2',
      newWallId: 'w2-copy',
      newPlacementIds: ['new-1', 'new-2', 'new-3'],
    })
    const clones = after.placements.filter((p) => p.wallId === 'w2-copy')
    expect(clones).toHaveLength(3)
    expect(clones.map((p) => p.id)).toEqual(['new-1', 'new-2', 'new-3'])
    expect(clones[0]).toMatchObject({
      id: 'new-1',
      photoId: 'ph-a',
      wallId: 'w2-copy',
      xCm: 100,
      yCm: 80,
      size: { mode: 'aspect', longEdgeCm: 30 },
    })
    expect(clones[1]).toMatchObject({
      id: 'new-2',
      photoId: 'ph-b',
      wallId: 'w2-copy',
      xCm: 200,
      yCm: 90,
      size: { mode: 'crop', widthCm: 42, heightCm: 28 },
    })
    // Margin-parked one carried over too.
    expect(clones[2]).toMatchObject({
      id: 'new-3',
      photoId: 'ph-a',
      wallId: 'w2-copy',
      xCm: -40,
      yCm: 50,
      size: { mode: 'aspect', longEdgeCm: 25 },
    })
  })

  it('leaves the source wall and its placements unchanged', () => {
    const before = seeded()
    const after = appReducer(before, {
      type: 'duplicateWall',
      sourceId: 'w2',
      newWallId: 'w2-copy',
      newPlacementIds: ['new-1', 'new-2', 'new-3'],
    })
    const source = after.walls.find((w) => w.id === 'w2')
    expect(source).toEqual(before.walls.find((w) => w.id === 'w2'))
    for (const id of ['pl-1', 'pl-2', 'pl-3', 'pl-other']) {
      expect(after.placements.find((p) => p.id === id)).toEqual(
        before.placements.find((p) => p.id === id),
      )
    }
  })

  it('does NOT create new photo entries — photos are shared', () => {
    const before = seeded()
    const after = appReducer(before, {
      type: 'duplicateWall',
      sourceId: 'w2',
      newWallId: 'w2-copy',
      newPlacementIds: ['new-1', 'new-2', 'new-3'],
    })
    expect(after.photos).toBe(before.photos)
  })

  it('inserts the new wall immediately after the source in the walls list', () => {
    const after = appReducer(seeded(), {
      type: 'duplicateWall',
      sourceId: 'w2',
      newWallId: 'w2-copy',
      newPlacementIds: ['new-1', 'new-2', 'new-3'],
    })
    expect(after.walls.map((w) => w.id)).toEqual(['w1', 'w2', 'w2-copy', 'w3'])
  })

  it('switches the active wall to the copy and clears the selection', () => {
    const after = appReducer(seeded(), {
      type: 'duplicateWall',
      sourceId: 'w2',
      newWallId: 'w2-copy',
      newPlacementIds: ['new-1', 'new-2', 'new-3'],
    })
    expect(after.ui.activeWallId).toBe('w2-copy')
    expect(after.ui.selectedPlacementIds).toEqual([])
  })

  it('duplicates an empty wall with no placements (creates only the wall copy)', () => {
    const before: ReturnType<typeof appReducer> = {
      ...initialState,
      walls: [{ id: 'wEmpty', name: 'Blank', widthCm: 400, heightCm: 200 }],
      placements: [],
      ui: {
        activeWallId: 'wEmpty',
        selectedPlacementIds: [],
        rulerEnabled: true,
        silhouetteEnabled: true,
      },
    }
    const after = appReducer(before, {
      type: 'duplicateWall',
      sourceId: 'wEmpty',
      newWallId: 'wEmpty-copy',
      newPlacementIds: [],
    })
    expect(after.walls.map((w) => w.id)).toEqual(['wEmpty', 'wEmpty-copy'])
    expect(after.walls[1]).toMatchObject({ name: 'Blank copy', widthCm: 400, heightCm: 200 })
    expect(after.placements).toEqual([])
    expect(after.ui.activeWallId).toBe('wEmpty-copy')
    expect(after.ui.selectedPlacementIds).toEqual([])
  })

  it('uses an explicit name override when provided', () => {
    const after = appReducer(seeded(), {
      type: 'duplicateWall',
      sourceId: 'w2',
      newWallId: 'w2-copy',
      name: 'Variant B',
      newPlacementIds: ['new-1', 'new-2', 'new-3'],
    })
    expect(after.walls.find((w) => w.id === 'w2-copy')).toMatchObject({
      name: 'Variant B',
    })
  })

  it('is a no-op when the source wall does not exist', () => {
    const before = seeded()
    const after = appReducer(before, {
      type: 'duplicateWall',
      sourceId: 'missing',
      newWallId: 'never',
      newPlacementIds: [],
    })
    expect(after).toBe(before)
  })

  it('clones placements independently — editing a clone does not touch the original', () => {
    const after = appReducer(seeded(), {
      type: 'duplicateWall',
      sourceId: 'w2',
      newWallId: 'w2-copy',
      newPlacementIds: ['new-1', 'new-2', 'new-3'],
    })
    const next = appReducer(after, {
      type: 'movePlacement',
      id: 'new-1',
      xCm: 999,
      yCm: 999,
    })
    expect(next.placements.find((p) => p.id === 'new-1')).toMatchObject({
      xCm: 999,
      yCm: 999,
    })
    // Original on the source wall is untouched.
    expect(next.placements.find((p) => p.id === 'pl-1')).toMatchObject({
      xCm: 100,
      yCm: 80,
    })
  })
})
