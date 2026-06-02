import type { AppState } from '../state/types'

/** Persistence boundary for the whole app state. */
export interface StatePort {
  load(): Promise<AppState | null>
  save(state: AppState): Promise<void>
}

/** In-memory implementation for tests and for injecting a known starting state. */
export function createMemoryStatePort(seed: AppState | null = null): StatePort {
  let stored: AppState | null = seed ? structuredClone(seed) : null
  return {
    async load() {
      return stored ? structuredClone(stored) : null
    },
    async save(state: AppState) {
      stored = structuredClone(state)
    },
  }
}
