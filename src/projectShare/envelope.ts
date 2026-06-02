import type { AppState } from '../state/types'

export const PROJECT_ENVELOPE_FORMAT = 'tenji-project'
export const PROJECT_ENVELOPE_VERSION = 1

export type ProjectEnvelope = {
  format: typeof PROJECT_ENVELOPE_FORMAT
  version: typeof PROJECT_ENVELOPE_VERSION
  exportedAt: string
  state: AppState
  images: Record<string, string>
}

export type ParseResult =
  | { ok: true; envelope: ProjectEnvelope }
  | { ok: false; error: string }

export type BuildProjectEnvelopeDeps = {
  state: AppState
  loadBlob: (key: string) => Promise<Blob | null>
  blobToBase64: (blob: Blob) => Promise<string>
  now: () => Date
}

export async function buildProjectEnvelope({
  state,
  loadBlob,
  blobToBase64,
  now,
}: BuildProjectEnvelopeDeps): Promise<ProjectEnvelope> {
  const images: Record<string, string> = {}
  for (const photo of state.photos) {
    const blob = await loadBlob(photo.blobKey)
    if (!blob) continue
    images[photo.blobKey] = await blobToBase64(blob)
  }
  return {
    format: PROJECT_ENVELOPE_FORMAT,
    version: PROJECT_ENVELOPE_VERSION,
    exportedAt: now().toISOString(),
    state,
    images,
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateState(s: unknown): s is AppState {
  if (!isPlainObject(s)) return false
  if (!Array.isArray(s.photos)) return false
  if (!Array.isArray(s.walls)) return false
  if (!Array.isArray(s.placements)) return false
  if (!isPlainObject(s.ui)) return false
  return true
}

export function parseProjectEnvelope(raw: unknown): ParseResult {
  if (!isPlainObject(raw)) return { ok: false, error: 'Envelope must be an object' }
  if (raw.format !== PROJECT_ENVELOPE_FORMAT) {
    return { ok: false, error: 'Wrong format marker' }
  }
  if (raw.version !== PROJECT_ENVELOPE_VERSION) {
    return { ok: false, error: 'Unsupported version' }
  }
  if (typeof raw.exportedAt !== 'string') {
    return { ok: false, error: 'Missing exportedAt' }
  }
  if (!validateState(raw.state)) {
    return { ok: false, error: 'Invalid state shape' }
  }
  if (!isPlainObject(raw.images)) {
    return { ok: false, error: 'Invalid images map' }
  }
  for (const v of Object.values(raw.images)) {
    if (typeof v !== 'string') {
      return { ok: false, error: 'Invalid image data url' }
    }
  }
  return {
    ok: true,
    envelope: {
      format: PROJECT_ENVELOPE_FORMAT,
      version: PROJECT_ENVELOPE_VERSION,
      exportedAt: raw.exportedAt,
      state: raw.state,
      images: raw.images as Record<string, string>,
    },
  }
}
