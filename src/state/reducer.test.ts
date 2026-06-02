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
