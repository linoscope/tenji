import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerBlobDownload } from './download'

describe('triggerBlobDownload', () => {
  const origCreate = URL.createObjectURL
  const origRevoke = URL.revokeObjectURL
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    URL.createObjectURL = origCreate
    URL.revokeObjectURL = origRevoke
  })

  it('creates an anchor with the blob url and given filename, clicks it, and revokes', () => {
    const click = vi.fn()
    const anchorEl = {
      href: '',
      download: '',
      style: {} as CSSStyleDeclaration,
      click,
    } as unknown as HTMLAnchorElement
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(anchorEl)
    const appendChild = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((n) => n)
    const removeChild = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((n) => n)

    const blob = new Blob(['x'], { type: 'image/png' })
    triggerBlobDownload(blob, 'wall.png')

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(anchorEl.href).toBe('blob:fake')
    expect(anchorEl.download).toBe('wall.png')
    expect(click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')

    createElement.mockRestore()
    appendChild.mockRestore()
    removeChild.mockRestore()
  })
})
