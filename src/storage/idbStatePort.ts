import { get, set } from 'idb-keyval'
import type { AppState } from '../state/types'
import type { StatePort } from './port'

const STATE_KEY = 'tenji:appState'

/** IndexedDB-backed persistence (production). */
export function createIdbStatePort(): StatePort {
  return {
    async load() {
      return (await get<AppState>(STATE_KEY)) ?? null
    },
    async save(state: AppState) {
      await set(STATE_KEY, state)
    },
  }
}
