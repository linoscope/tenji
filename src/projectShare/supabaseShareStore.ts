import { createClient } from '@supabase/supabase-js'
import type { ShareStore } from './shareStore'
import type { SupabaseConfig } from './supabaseConfig'

const BUCKET = 'tenji-snapshots'

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Thin Supabase Storage adapter. Each snapshot is a single immutable
 * `application/json` object named `<id>.json` in the public `tenji-snapshots`
 * bucket. Intentionally not unit-tested against the network — the real path is
 * covered by the opt-in Playwright e2e.
 */
export function createSupabaseShareStore(config: SupabaseConfig): ShareStore {
  const client = createClient(config.url, config.publishableKey)
  return {
    async createSnapshot(json: string) {
      const id = newId()
      const blob = new Blob([json], { type: 'application/json' })
      const { error } = await client.storage
        .from(BUCKET)
        .upload(`${id}.json`, blob, { contentType: 'application/json', upsert: false })
      if (error) throw new Error(`Snapshot upload failed: ${error.message}`)
      return { id }
    },
    async fetchSnapshot(id: string) {
      const { data, error } = await client.storage.from(BUCKET).download(`${id}.json`)
      if (error || !data) {
        throw new Error(`Snapshot fetch failed: ${error?.message ?? 'not found'}`)
      }
      return await data.text()
    },
  }
}
