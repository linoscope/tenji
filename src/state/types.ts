export type Wall = {
  id: string
  name: string
  widthCm: number
  heightCm: number
}

export type Photo = {
  id: string
  filename: string
  blobKey: string
  aspectRatio: number
}

export type Placement = {
  id: string
  photoId: string
  wallId: string
  /** Wall-relative cm of the photo's center. Values outside the wall mean "in the margin". */
  xCm: number
  yCm: number
  longEdgeCm: number
}

export type AppState = {
  photos: Photo[]
  walls: Wall[]
  placements: Placement[]
  ui: {
    activeWallId: string | null
    selectedPlacementId: string | null
    rulerEnabled: boolean
    silhouetteEnabled: boolean
  }
}
