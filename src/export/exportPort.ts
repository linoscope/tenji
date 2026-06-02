import { toPng } from 'html-to-image'

/**
 * Renders a DOM element as a PNG blob. Injected into App so tests can supply
 * a deterministic fake instead of pulling html-to-image into jsdom.
 */
export type ExportPort = {
  exportElement: (el: HTMLElement) => Promise<Blob>
}

export function createHtmlToImageExportPort(): ExportPort {
  return {
    async exportElement(el) {
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true })
      const res = await fetch(dataUrl)
      return res.blob()
    },
  }
}
