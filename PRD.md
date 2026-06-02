# PRD: Photo Exhibition Planner (Tenji)

## Problem Statement

I'm preparing for a photo exhibition and need to decide which photos to display
and how to arrange them on the walls. Right now I'm doing this in my head or with
ad-hoc tools, which makes it hard to judge whether a print is the right size for a
wall, whether the arrangement is balanced, and what I ultimately need to send to a
print shop. I want a simple, personal tool to plan all of this visually before I
commit to printing and hanging anything.

## Solution

A pure-frontend webapp (no login, no server) where I can:

- Create one or more **walls** by specifying their width/height in cm.
- Bring in my **photos** from local files (drag-and-drop, file picker, or clipboard paste).
- Place photos on a wall at a chosen **real-world print size** (A5–A0 presets or a custom
  cm size), shown truthfully to scale relative to the wall.
- **Drag photos around** to any position, with alignment guides that help me line things
  up the way a gallery would.
- **Park photos in the margin** beside the wall, or keep unplaced photos in a **tray**.
- Get a **sense of real-world scale** via a ruler, a human silhouette, and a floor line.
- **Export** a picture of the wall and a **print-shop table** listing every photo and its
  print size.

Everything is stored locally in the browser, so it works offline and my photos never leave
my machine.

## User Stories

### Walls

1. As Jerony, I want to create a new wall by entering its width and height in cm, so that the planning surface matches a real wall in my venue.
2. As Jerony, I want a new wall to be prefilled at 800 × 250 cm, so that I can start immediately and only tweak when needed.
3. As Jerony, I want to give each wall a name (defaulting to "Wall 1", "Wall 2", …), so that I can tell my walls apart.
4. As Jerony, I want to rename a wall, so that I can label it meaningfully (e.g. "North Wall", "Entrance").
5. As Jerony, I want to maintain multiple walls and switch between them from a sidebar, so that I can plan a multi-wall show.
6. As Jerony, I want to edit a wall's dimensions after creating it, so that I can correct or refine measurements as I learn them.
7. As Jerony, I want placed photos to keep their absolute cm positions when I resize a wall, so that my arrangement isn't scrambled by a dimension change.
8. As Jerony, I want a photo that falls outside a shrunken wall to remain visible in the margin, so that I don't silently lose it.
9. As Jerony, I want to delete a wall I no longer need, so that my workspace stays focused.
10. As Jerony, I want each wall rendered with a plain white background, so that it resembles a typical gallery wall.

### Importing photos

11. As Jerony, I want to import photos by dragging image files into the app, so that adding work is fast.
12. As Jerony, I want to import photos via a file picker, so that I can browse and select files.
13. As Jerony, I want to paste an image from my clipboard, so that I can quickly bring in a copied photo.
14. As Jerony, I want imported photos downscaled automatically, so that the app stays fast and storage stays small (print quality is irrelevant for planning).
15. As Jerony, I want my imported-but-unplaced photos to live in a tray, so that I have a holding area for candidates.
16. As Jerony, I want the photo tray to be shared across all walls, so that my photo library is global rather than trapped on one wall.
17. As Jerony, I want my photos and layouts to persist between sessions, so that I can close the tab and come back to my plan.

### Placing & sizing photos

18. As Jerony, I want to place a photo from the tray onto a wall, so that I can start arranging it.
19. As Jerony, I want a newly placed photo to default to A3, so that it starts at a reasonable size with minimal fiddling.
20. As Jerony, I want to choose a photo's size from A-series presets (A5, A4, A3, A2, A1, A0), so that I can think in familiar print sizes.
21. As Jerony, I want to set a custom size in cm (width/height), so that I'm not limited to standard formats.
22. As Jerony, I want the preset to set the photo's long edge while the short edge follows the photo's true aspect ratio, so that the photo is never distorted or cropped.
23. As Jerony, I want a photo's orientation (portrait/landscape) to follow the photo itself, so that I don't have to toggle it manually.
24. As Jerony, I want each photo rendered at its real size relative to the wall, so that proportions on screen are truthful.
25. As Jerony, I want to resize a selected photo by dragging its corner handles, so that I can adjust size visually.
26. As Jerony, I want the size fields/preset and the corner handles to stay in sync, so that visual and numeric editing agree.
27. As Jerony, I want to see a photo's current size label and cm dimensions when it's selected, so that I always know how big it will print.

### Arranging

28. As Jerony, I want to drag a photo to any position on the wall, so that I can compose the arrangement freely.
29. As Jerony, I want alignment guides to appear when a photo's edges or center line up with another photo or with the wall's center/edges, so that my layout looks intentionally hung.
30. As Jerony, I want photos to lightly snap to those alignment guides, so that precise alignment is effortless.
31. As Jerony, I want to see the numeric gap (in cm) between photos while dragging, so that I can space work evenly.
32. As Jerony, I want to be allowed to overlap photos, so that I can test tight arrangements.
33. As Jerony, I want overlaps flagged visually, so that I notice unintended collisions.
34. As Jerony, I want to drag a photo off the wall into the surrounding margin, so that I can temporarily set it aside near where it might go.
35. As Jerony, I want the whole wall to always be visible (fit-to-screen), so that I can judge the overall composition at a glance.
36. As Jerony, I want to select a single photo by clicking it, so that I can act on it.

### Per-photo actions

37. As Jerony, I want to send a placed photo back to the tray, so that I can remove it from the wall without losing it.
38. As Jerony, I want to delete a photo entirely, so that I can remove work I've decided against.

### Scale perception

39. As Jerony, I want a ruler with the wall's dimensions and tick marks, so that I can read distances precisely.
40. As Jerony, I want a faint ~170 cm human silhouette against the wall, so that I can feel whether prints read well at room scale.
41. As Jerony, I want a floor line, so that the silhouette and heights are grounded.
42. As Jerony, I want to toggle the ruler and silhouette on/off, so that I can declutter the view when I want.

### Output

43. As Jerony, I want to export a PNG image of a wall's arrangement, so that I can share it or compare layouts.
44. As Jerony, I want a table of every placed photo with its print size, so that I can hand it to a print shop.
45. As Jerony, I want the print table to cover all photos placed across all walls, so that it represents the whole show.
46. As Jerony, I want the same photo at the same size to be grouped into one row with a count, so that the print order is concise.
47. As Jerony, I want the table to show which wall(s) each photo appears on, so that it doubles as my own reference.
48. As Jerony, I want the table columns to include a thumbnail, filename, size label, W×H in cm, and orientation, so that the order is unambiguous.
49. As Jerony, I want to view the table on screen and download it as CSV, so that I can sanity-check it and then email it.
50. As Jerony, I want tray (unplaced) photos excluded from the print table, so that I'm not asked to print things I'm not showing.

### Tray: placed-photo marking

51. As Jerony, I want already-placed photos to look different from unplaced ones in the tray, so that I can see at a glance what I still have to work with.
52. As Jerony, I want a placed photo to be dimmed, so that my unplaced candidates visually stand out.
53. As Jerony, I want a placed photo to show which wall it's on (the wall's name, or "On: N walls" when it's on several), so that I remember where I already hung it.
54. As Jerony, I want placed photos to sort to the bottom of the tray while unplaced ones keep their order, so that the photos I haven't used yet are easiest to reach.
55. As Jerony, I want a photo marked placed if it's on any wall (not just the active one), so that the "have I used this?" signal is about the whole show.
56. As Jerony, I want a placed photo to remain draggable from the tray, so that I can place the same photo on another wall to compare arrangements.
57. As Jerony, I want a photo to revert to the unplaced look as soon as its last placement is removed (dragged off, sent to tray, or its placement/wall deleted), so that the tray always reflects reality.

## Implementation Decisions

### Architecture & stack
- Pure-frontend single-page app. No backend, no authentication, no network dependency at runtime.
- **Vite + React + TypeScript**.
- **DOM rendering**: the wall is a container; each photo is an absolutely-positioned element sized in pixels derived from cm. Chosen for crisp images, trivial hit-testing, and easy overlays.
- **react-rnd** for drag + corner-resize of photos. Custom alignment-guide/snap logic is layered on top (it is the app-specific part react-rnd does not provide).
- **html-to-image** for PNG export of a wall.
- **idb-keyval** over IndexedDB for persistence; image bytes stored as Blobs keyed by id, displayed via `URL.createObjectURL`.

### State model
- A single serializable application state, mutated through a **pure reducer** (the primary test seam). Conceptual shape:
  - `photos`: imported images — `{ id, filename, blobKey, aspectRatio }` (bytes live in IndexedDB under `blobKey`).
  - `walls`: `[{ id, name, widthCm, heightCm }]`.
  - `placements`: a photo placed/parked on a wall — `{ id, photoId, wallId, xCm, yCm, longEdgeCm }`. Position is wall-relative cm of the photo's center; values outside `0..widthCm`/`0..heightCm` mean "in the margin." A photo not placed anywhere is simply absent from `placements` (it lives only in the tray).
  - `ui`: `{ activeWallId, selectedPlacementId, showRuler, showSilhouette }`.
- Reducer actions (names indicative): `createWall`, `renameWall`, `resizeWall`, `deleteWall`, `setActiveWall`, `importPhotos`, `placePhotoOnWall`, `movePlacement`, `resizePlacement`, `sendToTray`, `deletePhoto`, `selectPlacement`, `toggleOverlay`.
- Persistence: the whole state object is saved to IndexedDB on change (debounced) and loaded on startup; image Blobs are stored separately by key.

### Sizing model
- Presets define **long-edge cm**: A5=21, A4=29.7, A3=42, A2=59.4, A1=84.1, A0=118.9. Custom mode takes explicit W/H.
- A pure function maps `(longEdgeCm, aspectRatio)` → `{ widthCm, heightCm, orientation }`, where orientation is derived from the image's aspect ratio. The wall stores `longEdgeCm`; width/height are derived for rendering and for the print table.

### Scale & geometry
- A pure function computes the **fit-to-screen** pixels-per-cm given wall dimensions plus the available viewport (with margin reserved around the wall for parking). All cm↔px conversions go through this scale; rendered size = cm × scale.
- A pure function computes **alignment guides and snap offsets**: given the moving photo's rect, the other photos' rects, and the wall bounds, it returns active guide lines (edge/center matches) and a snap delta. A companion function computes **gap distances** between the moving photo and neighbours.

### Print-shop table
- A pure function aggregates `placements` across all walls into rows grouped by `(photoId, longEdgeCm)`, each row carrying `count`, the set of wall names, derived W×H cm, size label (matched preset name or "Custom"), orientation, filename, and thumbnail reference. Tray-only photos are excluded. CSV is generated from these rows (thumbnail omitted from CSV).

### Tray view (placed-photo marking)
- The tray shows **every** imported photo (placement is visual state, never removal). A pure
  function — mirroring the print-shop aggregator — takes `{ photos, placements, walls }` and
  returns an **ordered list of tray items**, each carrying the photo, a `placed` flag, and the
  deduplicated wall names it sits on (in wall order). Unplaced items come first in photo order;
  placed items sort to the bottom. The tray component only renders this derived list.
- "Placed" means **≥1 placement on any wall**. Caption: none when unplaced; the wall name when
  on exactly one wall; "On: N walls" when on two or more. Placed items stay draggable.
- Derived entirely from existing state, so it updates automatically on place / move / send-to-tray
  / delete-photo / delete-wall with no schema change.

### Import behaviour
- File picker and clipboard paste add photos to the **tray**.
- Dragging an image file directly onto a wall imports it **and** places it at the drop point at the default size (A3).
- All imports are downscaled (target ~1500px on the long edge) before storage.

## Testing Decisions

- **What makes a good test here:** assert externally observable behaviour — the resulting state after an action, the values returned by pure geometry/sizing/aggregation functions — never internal structure or React implementation details. Tests should read as "given this input, the user-visible result is X."
- **Test runner:** Vitest (pairs naturally with Vite); React Testing Library for the few component-level checks.
- **Primary seam — the reducer.** Drive the app through reducer actions and assert state: e.g. placing a photo yields a placement at A3 at the given position; `sendToTray` removes the placement but keeps the photo; `resizeWall` leaves placements' cm positions unchanged; `deletePhoto` removes the photo and all its placements. This is the highest seam and covers most behaviour without a DOM.
- **Sizing module.** Test `(longEdgeCm, aspectRatio)` → dimensions/orientation across portrait, landscape, and square inputs, and that each preset yields the expected long edge.
- **Geometry module.** Test fit-to-screen scale for assorted wall/viewport ratios; test that alignment guides activate exactly when edges/centers coincide within tolerance and that snap deltas are correct; test gap measurement.
- **Print-table module.** Test grouping by `(photoId, size)` with correct counts and wall lists, "Custom" vs preset labelling, exclusion of tray photos, and CSV row generation.
- **Tray-view module.** Test the derived ordering (unplaced first in photo order, placed sunk to the bottom), the `placed` flag, deduplicated wall-name lists, the single-wall name vs "On: N walls" caption rule, and graceful handling of placements referencing a missing photo/wall (consistent with the print-table aggregator). One RTL check that a placed tray photo renders dimmed, shows its caption, and stays draggable.
- **Persistence seam.** Define a small storage port (save/load) and test serialization round-trips against an in-memory fake, so tests don't depend on real IndexedDB.
- **Deliberately not unit-tested:** low-level drag pointer choreography (react-rnd's responsibility) — the app-specific geometry it feeds is tested directly instead. A small number of RTL smoke tests may cover the inspector (changing a preset updates the displayed size).
- **Prior art:** none — greenfield. These conventions establish the prior art for future tests.

## Out of Scope

- Removing placed photos from the tray entirely — rejected in favour of marking them (they stay, dimmed).
- Setting custom width AND height independently — considered and dropped; long-edge sizing already covers the need (no matting or cropping).
- Per-active-wall tray membership, and any physical-wall-vs-layout-option distinction.
- Zoom and pan (fit-to-screen only; considered again and still deferred).
- Multi-select and group move/align.
- Snap-to-grid (alignment guides only).
- Photo rotation / hanging a print at an angle.
- A hang sheet with floor-referenced install coordinates (center-from-floor heights). The data model keeps positions center-based so this can be added later.
- A multi-wall floor-plan view with several walls on one canvas (the data model anticipates it; the view does not ship in v1).
- Wall background colour customisation (white only).
- Remote/URL image sources and cloud sync.
- User accounts, multi-user, sharing via server.
- Storing full-resolution originals.

## Further Notes

- "Jerony" is the sole user; there is no multi-user concern despite the user-story phrasing.
- The data model intentionally stores photo positions as wall-relative cm of the photo **center**, both to make alignment-to-center natural and to leave the door open for a future floor-referenced hang sheet.
- The app should work fully offline once loaded; deployment is a static build (suitable for Vercel import from this repo).
