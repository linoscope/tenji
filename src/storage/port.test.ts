import { describe, it, expect } from 'vitest'
import { createMemoryStatePort } from './port'
import { appReducer, initialState } from '../state/reducer'

describe('StatePort (memory fake)', () => {
  it('returns null when nothing has been saved', async () => {
    const port = createMemoryStatePort()
    expect(await port.load()).toBeNull()
  })

  it('round-trips saved state', async () => {
    const port = createMemoryStatePort()
    const state = appReducer(initialState, { type: 'createWall', id: 'w1' })

    await port.save(state)

    expect(await port.load()).toEqual(state)
  })

  it('stores a snapshot, not a live reference', async () => {
    const port = createMemoryStatePort()
    const state = appReducer(initialState, { type: 'createWall', id: 'w1' })

    await port.save(state)
    state.walls[0].name = 'mutated after save'

    const loaded = await port.load()
    expect(loaded?.walls[0].name).toBe('Wall 1')
  })
})
