/** URL-hash helpers for share links: `…/#share=<id>`. */

export type ShareUrlBase = { origin: string; pathname: string }

export function buildShareUrl(base: ShareUrlBase, id: string): string {
  return `${base.origin}${base.pathname}#share=${encodeURIComponent(id)}`
}

/** Extract the share id from a location hash (`#share=<id>` or `share=<id>`).
 *  Returns null when absent or empty. */
export function parseShareId(hash: string): string | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(h)
  const id = params.get('share')
  return id && id.length > 0 ? id : null
}
