import { describe, it, expect } from 'vitest'
import { buildShareUrl, parseShareId } from './shareHash'

describe('buildShareUrl / parseShareId', () => {
  it('builds a #share= URL and round-trips the id', () => {
    const url = buildShareUrl({ origin: 'https://tenji.app', pathname: '/' }, 'abc123')
    expect(url).toBe('https://tenji.app/#share=abc123')
    const hash = '#' + url.split('#')[1]
    expect(parseShareId(hash)).toBe('abc123')
  })

  it('encodes ids with special characters and decodes them back', () => {
    const url = buildShareUrl({ origin: 'https://tenji.app', pathname: '/tenji/' }, 'a b/c')
    expect(parseShareId('#' + url.split('#')[1])).toBe('a b/c')
  })

  it('returns null when there is no share id', () => {
    expect(parseShareId('')).toBeNull()
    expect(parseShareId('#')).toBeNull()
    expect(parseShareId('#foo=bar')).toBeNull()
    expect(parseShareId('#share=')).toBeNull()
  })

  it('parses a hash without the leading # too', () => {
    expect(parseShareId('share=xyz')).toBe('xyz')
  })
})
