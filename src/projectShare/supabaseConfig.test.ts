import { describe, it, expect } from 'vitest'
import { resolveSupabaseConfig } from './supabaseConfig'

describe('resolveSupabaseConfig', () => {
  it('returns a config when both url and publishable key are present', () => {
    expect(
      resolveSupabaseConfig({ url: 'https://x.supabase.co', publishableKey: 'sb_publishable_abc' }),
    ).toEqual({ url: 'https://x.supabase.co', publishableKey: 'sb_publishable_abc' })
  })

  it('returns null when either value is missing or blank', () => {
    expect(resolveSupabaseConfig({ url: 'https://x.supabase.co' })).toBeNull()
    expect(resolveSupabaseConfig({ publishableKey: 'sb_publishable_abc' })).toBeNull()
    expect(resolveSupabaseConfig({ url: '  ', publishableKey: 'sb_publishable_abc' })).toBeNull()
    expect(resolveSupabaseConfig({ url: 'https://x.supabase.co', publishableKey: '' })).toBeNull()
    expect(resolveSupabaseConfig({})).toBeNull()
  })

  it('trims surrounding whitespace', () => {
    expect(
      resolveSupabaseConfig({ url: ' https://x.supabase.co ', publishableKey: ' k ' }),
    ).toEqual({ url: 'https://x.supabase.co', publishableKey: 'k' })
  })
})
