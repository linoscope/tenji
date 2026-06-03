import { describe, it, expect } from 'vitest'
import { createMemoryShareStore } from './shareStore'

describe('ShareStore (memory fake)', () => {
  it('round-trips a snapshot by id', async () => {
    const store = createMemoryShareStore()
    const { id } = await store.createSnapshot('{"hello":"world"}')
    expect(await store.fetchSnapshot(id)).toBe('{"hello":"world"}')
  })

  it('gives each snapshot a distinct id (immutable, never overwrites)', async () => {
    const store = createMemoryShareStore()
    const a = await store.createSnapshot('A')
    const b = await store.createSnapshot('B')
    expect(a.id).not.toBe(b.id)
    expect(await store.fetchSnapshot(a.id)).toBe('A')
    expect(await store.fetchSnapshot(b.id)).toBe('B')
  })

  it('rejects an unknown id', async () => {
    const store = createMemoryShareStore()
    await expect(store.fetchSnapshot('nope')).rejects.toThrow(/not found/)
  })
})
