import { describe, it, expect } from 'vitest'
import {
  buildProjectEnvelope,
  parseProjectEnvelope,
  PROJECT_ENVELOPE_FORMAT,
  PROJECT_ENVELOPE_VERSION,
} from './envelope'
import type { AppState } from '../state/types'

const sampleState: AppState = {
  photos: [
    { id: 'p1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1.5 },
    { id: 'p2', filename: 'b.jpg', blobKey: 'b2', aspectRatio: 0.75 },
  ],
  walls: [{ id: 'w1', name: 'North', widthCm: 500, heightCm: 300 }],
  placements: [
    { id: 'pl1', photoId: 'p1', wallId: 'w1', xCm: 100, yCm: 80, size: { mode: 'aspect' as const, longEdgeCm: 42 } },
  ],
  ui: {
    activeWallId: 'w1',
    selectedPlacementIds: [],
    rulerEnabled: true,
    silhouetteEnabled: true,
  },
}

describe('buildProjectEnvelope', () => {
  it('wraps the full state with format/version/exportedAt and base64 images per blobKey', async () => {
    const blobToText = new Map<Blob, string>()
    const makeBlob = (type: string, text: string) => {
      const b = new Blob([text], { type })
      blobToText.set(b, text)
      return b
    }
    const blobs = new Map<string, Blob>([
      ['b1', makeBlob('image/jpeg', 'one')],
      ['b2', makeBlob('image/png', 'two')],
    ])
    const blobToBase64 = async (blob: Blob) => {
      const text = blobToText.get(blob) ?? ''
      return `data:${blob.type};base64,${text}`
    }
    const envelope = await buildProjectEnvelope({
      state: sampleState,
      loadBlob: async (key) => blobs.get(key) ?? null,
      blobToBase64,
      now: () => new Date('2026-06-03T12:00:00Z'),
    })
    expect(envelope.format).toBe(PROJECT_ENVELOPE_FORMAT)
    expect(envelope.version).toBe(PROJECT_ENVELOPE_VERSION)
    expect(envelope.exportedAt).toBe('2026-06-03T12:00:00.000Z')
    expect(envelope.state).toEqual(sampleState)
    expect(envelope.images).toEqual({
      b1: 'data:image/jpeg;base64,one',
      b2: 'data:image/png;base64,two',
    })
  })

  it('omits images whose blob is missing from storage rather than throwing', async () => {
    const envelope = await buildProjectEnvelope({
      state: sampleState,
      loadBlob: async (key) => (key === 'b1' ? new Blob(['ok']) : null),
      blobToBase64: async () => 'data:application/octet-stream;base64,ok',
      now: () => new Date('2026-06-03T12:00:00Z'),
    })
    expect(Object.keys(envelope.images)).toEqual(['b1'])
  })
})

describe('parseProjectEnvelope', () => {
  it('returns ok with the parsed state and images for a well-formed envelope', () => {
    const raw = {
      format: PROJECT_ENVELOPE_FORMAT,
      version: PROJECT_ENVELOPE_VERSION,
      exportedAt: '2026-06-03T12:00:00.000Z',
      state: sampleState,
      images: { b1: 'data:image/jpeg;base64,one' },
    }
    const result = parseProjectEnvelope(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.envelope.state).toEqual(sampleState)
      expect(result.envelope.images).toEqual({ b1: 'data:image/jpeg;base64,one' })
    }
  })

  it('rejects a wrong format marker', () => {
    const result = parseProjectEnvelope({
      format: 'other-format',
      version: 1,
      exportedAt: 'x',
      state: sampleState,
      images: {},
    })
    expect(result.ok).toBe(false)
  })

  it('rejects an unsupported version', () => {
    const result = parseProjectEnvelope({
      format: PROJECT_ENVELOPE_FORMAT,
      version: 999,
      exportedAt: 'x',
      state: sampleState,
      images: {},
    })
    expect(result.ok).toBe(false)
  })

  it('rejects malformed shape (missing state)', () => {
    const result = parseProjectEnvelope({
      format: PROJECT_ENVELOPE_FORMAT,
      version: PROJECT_ENVELOPE_VERSION,
      exportedAt: 'x',
      images: {},
    })
    expect(result.ok).toBe(false)
  })

  it('rejects non-object input (string, null) without throwing', () => {
    expect(parseProjectEnvelope('not json').ok).toBe(false)
    expect(parseProjectEnvelope(null).ok).toBe(false)
    expect(parseProjectEnvelope(undefined).ok).toBe(false)
  })

  it('rejects when state shape is wrong (missing walls)', () => {
    const result = parseProjectEnvelope({
      format: PROJECT_ENVELOPE_FORMAT,
      version: PROJECT_ENVELOPE_VERSION,
      exportedAt: 'x',
      state: { photos: [], placements: [], ui: {} },
      images: {},
    })
    expect(result.ok).toBe(false)
  })

  it('rejects when images is not an object', () => {
    const result = parseProjectEnvelope({
      format: PROJECT_ENVELOPE_FORMAT,
      version: PROJECT_ENVELOPE_VERSION,
      exportedAt: 'x',
      state: sampleState,
      images: [],
    })
    expect(result.ok).toBe(false)
  })

  it('round-trips with buildProjectEnvelope', async () => {
    const built = await buildProjectEnvelope({
      state: sampleState,
      loadBlob: async () => new Blob(['x']),
      blobToBase64: async () => 'data:image/png;base64,x',
      now: () => new Date('2026-06-03T12:00:00Z'),
    })
    const result = parseProjectEnvelope(JSON.parse(JSON.stringify(built)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.envelope).toEqual(built)
    }
  })
})
