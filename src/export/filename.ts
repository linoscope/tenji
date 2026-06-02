export function wallExportFilename(wallName: string): string {
  const slug = wallName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'wall'}.png`
}
