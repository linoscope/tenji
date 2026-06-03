/** Transport for immutable project snapshots. Stores opaque JSON text under a
 *  generated id; reads it back by id. Content-agnostic (the App serializes a
 *  ProjectEnvelope into the JSON). */
export interface ShareStore {
  /** Upload a snapshot; returns its generated id (the share link carries this). */
  createSnapshot(json: string): Promise<{ id: string }>
  /** Fetch a snapshot's JSON by id. Rejects if the id is unknown. */
  fetchSnapshot(id: string): Promise<string>
}

/** In-memory implementation for tests. Deterministic ids (`mem-1`, `mem-2`, …). */
export function createMemoryShareStore(): ShareStore {
  const map = new Map<string, string>()
  let counter = 0
  return {
    async createSnapshot(json: string) {
      const id = `mem-${++counter}`
      map.set(id, json)
      return { id }
    },
    async fetchSnapshot(id: string) {
      const found = map.get(id)
      if (found === undefined) throw new Error(`snapshot not found: ${id}`)
      return found
    },
  }
}
