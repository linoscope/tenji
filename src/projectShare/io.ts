/** Injection seam mirrors the photoImport pattern: pure logic depends on these,
 *  the browser ships real impls.
 */
export type BlobToBase64 = (blob: Blob) => Promise<string>
export type Base64ToBlob = (dataUrl: string) => Promise<Blob>

export const browserBlobToBase64: BlobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('expected string data URL'))
    }
    reader.readAsDataURL(blob)
  })

export const browserBase64ToBlob: Base64ToBlob = async (dataUrl) => {
  const res = await fetch(dataUrl)
  return await res.blob()
}
