import { describe, it, expect, beforeAll } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createMemoryStatePort } from './storage/port'
import { createMemoryBlobStore } from './storage/blobStore'
import { appReducer, initialState } from './state/reducer'

function seededPort() {
  const saved = appReducer(initialState, {
    type: 'createWall',
    id: 'saved-wall',
    name: 'North Wall',
    widthCm: 500,
    heightCm: 300,
  })
  return createMemoryStatePort(saved)
}

/** jsdom lacks createObjectURL; stub it so tray thumbnails render. */
beforeAll(() => {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => 'blob:fake-url'
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = () => {}
  }
})

const fakeImageOps = {
  decodeImage: async () => ({ width: 3000, height: 2000 }),
  downscale: async (file: Blob) => ({ blob: file, width: 1500, height: 1000 }),
}

/**
 * jsdom's DragEvent ignores clientX/Y from init; build a real DragEvent and
 * pin the coordinates so the wall's drop handler can convert them to cm.
 */
function fireDropAt(
  el: Element,
  init: { dataTransfer: unknown; clientX: number; clientY: number },
) {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: init.dataTransfer })
  Object.defineProperty(event, 'clientX', { value: init.clientX })
  Object.defineProperty(event, 'clientY', { value: init.clientY })
  act(() => {
    el.dispatchEvent(event)
  })
}

describe('App', () => {
  it('creates a default 800 x 250 wall when nothing is saved', async () => {
    render(<App port={createMemoryStatePort()} createId={() => 'new-wall'} />)

    const wall = await screen.findByTestId('wall')
    expect(wall).toHaveAttribute('data-width-cm', '800')
    expect(wall).toHaveAttribute('data-height-cm', '250')
  })

  it('restores a previously saved wall on load', async () => {
    render(<App port={seededPort()} createId={() => 'unused'} />)

    const wall = await screen.findByTestId('wall')
    expect(wall).toHaveAttribute('data-width-cm', '500')
    expect(screen.getByText('North Wall')).toBeInTheDocument()
  })

  it('adds a new wall when the user asks for one', async () => {
    const user = userEvent.setup()
    render(<App port={seededPort()} createId={() => 'second-wall'} />)

    await screen.findByText('North Wall')
    await user.click(screen.getByRole('button', { name: /add wall/i }))

    await waitFor(() => expect(screen.getByText('Wall 2')).toBeInTheDocument())
  })

  it('switches the active wall when the user clicks one in the sidebar', async () => {
    const user = userEvent.setup()
    let n = 0
    render(<App port={seededPort()} createId={() => `extra-${++n}`} />)

    await screen.findByText('North Wall')
    await user.click(screen.getByRole('button', { name: /add wall/i }))

    // After adding, the new wall is active and shows in the stage.
    let stage = await screen.findByTestId('wall')
    expect(stage).toHaveAttribute('data-width-cm', '800')

    // Click the original wall in the sidebar to switch.
    await user.click(screen.getByRole('button', { name: /north wall/i }))

    await waitFor(() => {
      stage = screen.getByTestId('wall')
      expect(stage).toHaveAttribute('data-width-cm', '500')
    })
  })

  it('renames the active wall via the editor', async () => {
    const user = userEvent.setup()
    render(<App port={seededPort()} createId={() => 'unused'} />)

    await screen.findByText('North Wall')

    const nameInput = screen.getByLabelText(/wall name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'South Wall')

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /south wall/i })).toBeInTheDocument(),
    )
  })

  it('resizes the active wall via the editor', async () => {
    render(<App port={seededPort()} createId={() => 'unused'} />)

    await screen.findByText('North Wall')

    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '600' } })
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '180' } })

    await waitFor(() => {
      const wall = screen.getByTestId('wall')
      expect(wall).toHaveAttribute('data-width-cm', '600')
      expect(wall).toHaveAttribute('data-height-cm', '180')
    })
  })

  it('imports a photo via the file picker and shows it in the tray', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `photo-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')

    const file = new File(['data'], 'cat.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/import photos/i) as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() =>
      expect(screen.getByTestId('tray-photo-photo-1')).toBeInTheDocument(),
    )
    expect(screen.getByAltText('cat.jpg')).toBeInTheDocument()
  })

  it('stores the imported blob in the blob store under the photo id', async () => {
    const user = userEvent.setup()
    const blobStore = createMemoryBlobStore()
    render(
      <App
        port={seededPort()}
        blobStore={blobStore}
        createId={() => 'photo-1'}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')

    const file = new File(['data'], 'cat.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/import photos/i) as HTMLInputElement
    await user.upload(input, file)

    await waitFor(async () =>
      expect(await blobStore.load('photo-1')).not.toBeNull(),
    )
  })

  it('persists imported photos across reloads', async () => {
    const user = userEvent.setup()
    const port = seededPort()
    const blobStore = createMemoryBlobStore()
    const { unmount } = render(
      <App
        port={port}
        blobStore={blobStore}
        createId={() => 'photo-1'}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('tray-photo-photo-1')).toBeInTheDocument(),
    )

    unmount()

    render(
      <App
        port={port}
        blobStore={blobStore}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    expect(await screen.findByTestId('tray-photo-photo-1')).toBeInTheDocument()
    expect(screen.getByAltText('cat.jpg')).toBeInTheDocument()
  })

  it('imports photos when files are dropped onto the app', async () => {
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => 'photo-drop'}
        imageOps={fakeImageOps}
      />,
    )
    await screen.findByText('North Wall')

    const file = new File(['data'], 'dropped.jpg', { type: 'image/jpeg' })
    fireEvent.drop(screen.getByTestId('app-root'), {
      dataTransfer: { files: [file], types: ['Files'] },
    })

    await waitFor(() =>
      expect(screen.getByTestId('tray-photo-photo-drop')).toBeInTheDocument(),
    )
    expect(screen.getByAltText('dropped.jpg')).toBeInTheDocument()
  })

  it('imports photos pasted from the clipboard', async () => {
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => 'photo-paste'}
        imageOps={fakeImageOps}
      />,
    )
    await screen.findByText('North Wall')

    const file = new File(['data'], 'pasted.png', { type: 'image/png' })
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      },
    })
    window.dispatchEvent(event)

    await waitFor(() =>
      expect(screen.getByTestId('tray-photo-photo-paste')).toBeInTheDocument(),
    )
    expect(screen.getByAltText('pasted.png')).toBeInTheDocument()
  })

  it('shares the tray across walls (photo visible after switching walls)', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `id-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByTestId('tray-photo-id-1')

    // Add a second wall and switch to it.
    await user.click(screen.getByRole('button', { name: /add wall/i }))
    // After clicking "Add wall", the new wall is now active.
    expect(screen.getByTestId('tray-photo-id-1')).toBeInTheDocument()
  })

  it('places a photo on the wall when a tray photo is dragged onto it', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `id-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByTestId('tray-photo-id-1')

    // Pin a real-looking bounding rect on the wall so cm coordinates resolve.
    const wall = screen.getByTestId('wall') as HTMLElement
    wall.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect

    const dataTransfer = {
      types: ['application/x-tenji-photo'],
      getData: (t: string) =>
        t === 'application/x-tenji-photo' ? 'id-1' : '',
      files: { length: 0 } as unknown as FileList,
    }

    fireEvent.dragOver(wall, { dataTransfer })
    fireDropAt(wall, { dataTransfer, clientX: 100, clientY: 60 })

    const placement = await screen.findByTestId('placement-id-2')
    expect(placement).toHaveAttribute('data-photo-id', 'id-1')
    expect(placement).toHaveAttribute('data-long-edge-cm', '42')
  })

  it('selects a placement on click and deselects when the wall is clicked', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `id-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByTestId('tray-photo-id-1')

    const wall = screen.getByTestId('wall') as HTMLElement
    wall.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect

    const dataTransfer = {
      types: ['application/x-tenji-photo'],
      getData: () => 'id-1',
      files: { length: 0 } as unknown as FileList,
    }
    fireEvent.dragOver(wall, { dataTransfer })
    fireDropAt(wall, { dataTransfer, clientX: 100, clientY: 60 })

    const placement = await screen.findByTestId('placement-id-2')
    // Selected on creation.
    expect(placement).toHaveAttribute('data-selected', 'true')

    // Click empty wall to deselect.
    fireEvent.mouseDown(wall, { clientX: 5, clientY: 5 })
    await waitFor(() =>
      expect(screen.getByTestId('placement-id-2')).toHaveAttribute(
        'data-selected',
        'false',
      ),
    )

    // Click the placement to reselect.
    fireEvent.mouseDown(placement, { clientX: 10, clientY: 10 })
    await waitFor(() =>
      expect(screen.getByTestId('placement-id-2')).toHaveAttribute(
        'data-selected',
        'true',
      ),
    )
  })

  it('moves a placement by dragging it', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `id-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByTestId('tray-photo-id-1')

    const wall = screen.getByTestId('wall') as HTMLElement
    wall.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect

    const dataTransfer = {
      types: ['application/x-tenji-photo'],
      getData: () => 'id-1',
      files: { length: 0 } as unknown as FileList,
    }
    fireEvent.dragOver(wall, { dataTransfer })
    fireDropAt(wall, { dataTransfer, clientX: 100, clientY: 60 })

    const placement = await screen.findByTestId('placement-id-2')
    const initialX = Number(placement.getAttribute('data-x-cm'))
    const initialY = Number(placement.getAttribute('data-y-cm'))

    // Press, move by 50 px right & 30 px down, release.
    fireEvent.mouseDown(placement, { clientX: 100, clientY: 60 })
    fireEvent.mouseMove(window, { clientX: 150, clientY: 90 })
    fireEvent.mouseUp(window, { clientX: 150, clientY: 90 })

    await waitFor(() => {
      const after = screen.getByTestId('placement-id-2')
      expect(Number(after.getAttribute('data-x-cm'))).toBeGreaterThan(initialX)
      expect(Number(after.getAttribute('data-y-cm'))).toBeGreaterThan(initialY)
    })
  })

  it('shows corner resize handles only on the selected placement', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `id-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByTestId('tray-photo-id-1')

    const wall = screen.getByTestId('wall') as HTMLElement
    wall.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect

    const dataTransfer = {
      types: ['application/x-tenji-photo'],
      getData: () => 'id-1',
      files: { length: 0 } as unknown as FileList,
    }
    fireEvent.dragOver(wall, { dataTransfer })
    fireDropAt(wall, { dataTransfer, clientX: 100, clientY: 60 })

    const placement = await screen.findByTestId('placement-id-2')
    expect(placement).toHaveAttribute('data-selected', 'true')
    // 4 corners while selected.
    expect(
      placement.querySelectorAll('[data-resize-handle]'),
    ).toHaveLength(4)

    // Deselect → no handles.
    fireEvent.mouseDown(wall, { clientX: 5, clientY: 5 })
    await waitFor(() =>
      expect(
        screen.getByTestId('placement-id-2').querySelectorAll(
          '[data-resize-handle]',
        ),
      ).toHaveLength(0),
    )
  })

  it('resizes a placement when a corner handle is dragged outward', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `id-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByTestId('tray-photo-id-1')

    const wall = screen.getByTestId('wall') as HTMLElement
    wall.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect

    const dataTransfer = {
      types: ['application/x-tenji-photo'],
      getData: () => 'id-1',
      files: { length: 0 } as unknown as FileList,
    }
    fireEvent.dragOver(wall, { dataTransfer })
    fireDropAt(wall, { dataTransfer, clientX: 100, clientY: 60 })

    const placement = await screen.findByTestId('placement-id-2')
    const initialLongEdge = Number(placement.getAttribute('data-long-edge-cm'))

    const handle = placement.querySelector(
      '[data-resize-handle="se"]',
    ) as HTMLElement
    expect(handle).toBeTruthy()

    // Drag the SE corner outward (away from the photo's center at 100,60).
    fireEvent.mouseDown(handle, { clientX: 120, clientY: 80 })
    fireEvent.mouseMove(window, { clientX: 200, clientY: 160 })
    fireEvent.mouseUp(window, { clientX: 200, clientY: 160 })

    await waitFor(() => {
      const after = screen.getByTestId('placement-id-2')
      expect(Number(after.getAttribute('data-long-edge-cm'))).toBeGreaterThan(
        initialLongEdge,
      )
    })
  })

  it('shows an inspector with size label and W×H cm for the selected placement', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `id-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByTestId('tray-photo-id-1')

    const wall = screen.getByTestId('wall') as HTMLElement
    wall.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect

    const dataTransfer = {
      types: ['application/x-tenji-photo'],
      getData: () => 'id-1',
      files: { length: 0 } as unknown as FileList,
    }
    fireEvent.dragOver(wall, { dataTransfer })
    fireDropAt(wall, { dataTransfer, clientX: 100, clientY: 60 })

    await screen.findByTestId('placement-id-2')

    // Default size is A3 (42 cm long edge); aspectRatio = 3000/2000 = 1.5
    // → width 42, height 28.
    const inspector = await screen.findByTestId('placement-inspector')
    expect(inspector).toHaveTextContent('A3')
    expect(inspector).toHaveTextContent(/42\s*×\s*28\s*cm/)
  })

  it('changes a placement size when an A-series preset is picked in the inspector', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `id-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByTestId('tray-photo-id-1')

    const wall = screen.getByTestId('wall') as HTMLElement
    wall.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect

    const dataTransfer = {
      types: ['application/x-tenji-photo'],
      getData: () => 'id-1',
      files: { length: 0 } as unknown as FileList,
    }
    fireEvent.dragOver(wall, { dataTransfer })
    fireDropAt(wall, { dataTransfer, clientX: 100, clientY: 60 })

    await screen.findByTestId('placement-id-2')

    // Pick A2 (long edge 59.4 cm).
    await user.click(screen.getByRole('button', { name: 'A2' }))

    await waitFor(() => {
      const placement = screen.getByTestId('placement-id-2')
      expect(Number(placement.getAttribute('data-long-edge-cm'))).toBeCloseTo(
        59.4,
      )
    })
    expect(screen.getByTestId('placement-inspector')).toHaveTextContent('A2')
  })

  it('changes a placement size via the custom long-edge input in the inspector', async () => {
    const user = userEvent.setup()
    let n = 0
    render(
      <App
        port={seededPort()}
        blobStore={createMemoryBlobStore()}
        createId={() => `id-${++n}`}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByText('North Wall')
    await user.upload(
      screen.getByLabelText(/import photos/i) as HTMLInputElement,
      new File(['data'], 'cat.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByTestId('tray-photo-id-1')

    const wall = screen.getByTestId('wall') as HTMLElement
    wall.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect

    const dataTransfer = {
      types: ['application/x-tenji-photo'],
      getData: () => 'id-1',
      files: { length: 0 } as unknown as FileList,
    }
    fireEvent.dragOver(wall, { dataTransfer })
    fireDropAt(wall, { dataTransfer, clientX: 100, clientY: 60 })

    await screen.findByTestId('placement-id-2')

    const input = screen.getByLabelText(/long edge/i)
    fireEvent.change(input, { target: { value: '50' } })

    await waitFor(() => {
      const placement = screen.getByTestId('placement-id-2')
      expect(Number(placement.getAttribute('data-long-edge-cm'))).toBeCloseTo(50)
    })
    // 50 cm long edge, aspect 1.5 → 50 × 33.33 cm; not a preset → "Custom".
    expect(screen.getByTestId('placement-inspector')).toHaveTextContent('Custom')
  })

  it('deletes the active wall and shows the next one', async () => {
    const user = userEvent.setup()
    let n = 0
    render(<App port={seededPort()} createId={() => `extra-${++n}`} />)

    await screen.findByText('North Wall')
    await user.click(screen.getByRole('button', { name: /add wall/i }))
    await screen.findByText('Wall 2')

    // "Wall 2" is active; delete it.
    await user.click(screen.getByRole('button', { name: /delete wall/i }))

    await waitFor(() => expect(screen.queryByText('Wall 2')).not.toBeInTheDocument())
    const wall = screen.getByTestId('wall')
    expect(wall).toHaveAttribute('data-width-cm', '500')
  })

  it('flags overlapping placements visually (without preventing the overlap)', async () => {
    // Two placements at the same spot — they overlap.
    const seeded = {
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
        { id: 'photo-2', filename: 'b.jpg', blobKey: 'b2', aspectRatio: 1 },
      ],
      walls: [
        { id: 'w1', name: 'North Wall', widthCm: 500, heightCm: 300 },
      ],
      placements: [
        { id: 'pl-a', photoId: 'photo-1', wallId: 'w1', xCm: 100, yCm: 150, longEdgeCm: 42 },
        { id: 'pl-b', photoId: 'photo-2', wallId: 'w1', xCm: 110, yCm: 150, longEdgeCm: 42 },
      ],
      ui: { activeWallId: 'w1', selectedPlacementId: null, rulerEnabled: true, silhouetteEnabled: true },
    }
    render(
      <App
        port={createMemoryStatePort(seeded)}
        blobStore={createMemoryBlobStore()}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    const a = await screen.findByTestId('placement-pl-a')
    const b = await screen.findByTestId('placement-pl-b')
    expect(a).toHaveAttribute('data-overlapping', 'true')
    expect(b).toHaveAttribute('data-overlapping', 'true')
  })

  it('does not flag overlap when placements are clearly apart', async () => {
    const seeded = {
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
        { id: 'photo-2', filename: 'b.jpg', blobKey: 'b2', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'North Wall', widthCm: 500, heightCm: 300 }],
      placements: [
        { id: 'pl-a', photoId: 'photo-1', wallId: 'w1', xCm: 100, yCm: 100, longEdgeCm: 42 },
        { id: 'pl-b', photoId: 'photo-2', wallId: 'w1', xCm: 400, yCm: 250, longEdgeCm: 42 },
      ],
      ui: { activeWallId: 'w1', selectedPlacementId: null, rulerEnabled: true, silhouetteEnabled: true },
    }
    render(
      <App
        port={createMemoryStatePort(seeded)}
        blobStore={createMemoryBlobStore()}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    const a = await screen.findByTestId('placement-pl-a')
    const b = await screen.findByTestId('placement-pl-b')
    expect(a).toHaveAttribute('data-overlapping', 'false')
    expect(b).toHaveAttribute('data-overlapping', 'false')
  })

  it('shows alignment guides and a gap label while dragging a placement', async () => {
    // Two placements whose centers align horizontally; drag one near the other.
    // Wall height is 302 (center=151) so the sibling-center guide wins over
    // the wall-center guide when the dragged y is 150.
    const seeded = {
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
        { id: 'photo-2', filename: 'b.jpg', blobKey: 'b2', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'North Wall', widthCm: 500, heightCm: 302 }],
      placements: [
        { id: 'pl-a', photoId: 'photo-1', wallId: 'w1', xCm: 100, yCm: 150, longEdgeCm: 42 },
        { id: 'pl-b', photoId: 'photo-2', wallId: 'w1', xCm: 300, yCm: 150, longEdgeCm: 42 },
      ],
      ui: { activeWallId: 'w1', selectedPlacementId: null, rulerEnabled: true, silhouetteEnabled: true },
    }
    render(
      <App
        port={createMemoryStatePort(seeded)}
        blobStore={createMemoryBlobStore()}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    const placementA = await screen.findByTestId('placement-pl-a')

    // Start drag; while held, a sibling-center-horizontal guide should appear
    // because the dragged center-Y (150) equals the other's center-Y (150).
    fireEvent.mouseDown(placementA, { clientX: 0, clientY: 0 })
    fireEvent.mouseMove(window, { clientX: 1, clientY: 0 })

    await waitFor(() => {
      const wall = screen.getByTestId('wall')
      const guides = wall.querySelectorAll('[data-testid^="guide-"]')
      // Helpful diagnostic if it fails.
      expect(
        Array.from(guides).map((g) => g.getAttribute('data-testid')),
      ).toContain('guide-sibling-center-horizontal')
    })
    // A gap label to pl-b should also be shown (they're at the same y, on a
    // shared horizontal line, with a horizontal gap between them).
    expect(screen.getByTestId('gap-pl-b')).toBeInTheDocument()

    fireEvent.mouseUp(window)
    // Guides go away after the drag ends.
    await waitFor(() =>
      expect(
        screen.queryByTestId('guide-sibling-center-horizontal'),
      ).not.toBeInTheDocument(),
    )
  })

  it('parks a placement free-positioned in the margin when dragged outside the wall', async () => {
    const seeded = {
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'North Wall', widthCm: 500, heightCm: 300 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 100,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementId: null, rulerEnabled: true, silhouetteEnabled: true },
    }
    render(
      <App
        port={createMemoryStatePort(seeded)}
        blobStore={createMemoryBlobStore()}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    const placement = await screen.findByTestId('placement-pl-1')

    // Drag far enough to the left that the placement center goes outside the
    // wall (negative xCm). The reducer must accept the parked position.
    fireEvent.mouseDown(placement, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: -300, clientY: 100 })
    fireEvent.mouseUp(window, { clientX: -300, clientY: 100 })

    await waitFor(() => {
      const after = screen.getByTestId('placement-pl-1')
      expect(Number(after.getAttribute('data-x-cm'))).toBeLessThan(0)
    })
  })

  it('sends a placement to the tray via the inspector (placement removed, photo kept)', async () => {
    const user = userEvent.setup()
    const seeded = {
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'North Wall', widthCm: 500, heightCm: 300 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 100,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementId: 'pl-1', rulerEnabled: true, silhouetteEnabled: true },
    }
    render(
      <App
        port={createMemoryStatePort(seeded)}
        blobStore={createMemoryBlobStore()}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByTestId('placement-inspector')

    await user.click(screen.getByRole('button', { name: /send to tray/i }))

    await waitFor(() =>
      expect(screen.queryByTestId('placement-pl-1')).not.toBeInTheDocument(),
    )
    // Photo remains in the tray.
    expect(screen.getByTestId('tray-photo-photo-1')).toBeInTheDocument()
    // Inspector goes away because nothing is selected.
    expect(screen.queryByTestId('placement-inspector')).not.toBeInTheDocument()
  })

  it('deletes a photo (and all its placements across walls) via the inspector', async () => {
    const user = userEvent.setup()
    const seeded = {
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
        { id: 'photo-2', filename: 'b.jpg', blobKey: 'b2', aspectRatio: 1 },
      ],
      walls: [
        { id: 'w1', name: 'North Wall', widthCm: 500, heightCm: 300 },
        { id: 'w2', name: 'East Wall', widthCm: 500, heightCm: 300 },
      ],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 100,
          longEdgeCm: 42,
        },
        {
          id: 'pl-2',
          photoId: 'photo-1',
          wallId: 'w2',
          xCm: 100,
          yCm: 100,
          longEdgeCm: 42,
        },
        {
          id: 'pl-3',
          photoId: 'photo-2',
          wallId: 'w1',
          xCm: 300,
          yCm: 100,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementId: 'pl-1', rulerEnabled: true, silhouetteEnabled: true },
    }
    render(
      <App
        port={createMemoryStatePort(seeded)}
        blobStore={createMemoryBlobStore()}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    await screen.findByTestId('placement-inspector')

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    // Photo gone from tray.
    await waitFor(() =>
      expect(screen.queryByTestId('tray-photo-photo-1')).not.toBeInTheDocument(),
    )
    // Both placements of photo-1 gone, across both walls.
    expect(screen.queryByTestId('placement-pl-1')).not.toBeInTheDocument()
    // Other photo + placement still present.
    expect(screen.getByTestId('tray-photo-photo-2')).toBeInTheDocument()
    expect(screen.getByTestId('placement-pl-3')).toBeInTheDocument()
  })

  it('persists a parked placement (out-of-bounds position) across reload', async () => {
    const port = createMemoryStatePort({
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'North Wall', widthCm: 500, heightCm: 300 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: -40,
          yCm: 100,
          longEdgeCm: 42,
        },
      ],
      ui: { activeWallId: 'w1', selectedPlacementId: null, rulerEnabled: true, silhouetteEnabled: true },
    })
    const blobStore = createMemoryBlobStore()
    const { unmount } = render(
      <App
        port={port}
        blobStore={blobStore}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    const placement = await screen.findByTestId('placement-pl-1')
    expect(Number(placement.getAttribute('data-x-cm'))).toBe(-40)

    unmount()

    render(
      <App
        port={port}
        blobStore={blobStore}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    const restored = await screen.findByTestId('placement-pl-1')
    expect(Number(restored.getAttribute('data-x-cm'))).toBe(-40)
  })

  it('snaps a near-center drag to the other photo center-Y on release', async () => {
    // Two placements whose Y centers differ by 1 cm. A drag that just nudges
    // the dragged one (no significant Y movement, but enough X to commit)
    // should still snap Y to the neighbour's center within tolerance.
    const seeded = {
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
        { id: 'photo-2', filename: 'b.jpg', blobKey: 'b2', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'North Wall', widthCm: 500, heightCm: 300 }],
      placements: [
        // pl-a center-Y = 150
        { id: 'pl-a', photoId: 'photo-1', wallId: 'w1', xCm: 100, yCm: 150, longEdgeCm: 42 },
        // pl-b center-Y = 150.5 → within 1cm tolerance of pl-a's 150
        { id: 'pl-b', photoId: 'photo-2', wallId: 'w1', xCm: 300, yCm: 150.5, longEdgeCm: 42 },
      ],
      ui: { activeWallId: 'w1', selectedPlacementId: null, rulerEnabled: true, silhouetteEnabled: true },
    }
    render(
      <App
        port={createMemoryStatePort(seeded)}
        blobStore={createMemoryBlobStore()}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
      />,
    )

    const placementB = await screen.findByTestId('placement-pl-b')
    expect(Number(placementB.getAttribute('data-y-cm'))).toBeCloseTo(150.5)

    // Drag pl-b a small distance horizontally; Y unchanged → still within
    // tolerance of pl-a's 150, so on release pl-b snaps to y=150.
    fireEvent.mouseDown(placementB, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 120, clientY: 100 })
    fireEvent.mouseUp(window, { clientX: 120, clientY: 100 })

    await waitFor(() => {
      const after = screen.getByTestId('placement-pl-b')
      expect(Number(after.getAttribute('data-y-cm'))).toBeCloseTo(150)
    })
  })

  it('renders ruler ticks, a silhouette, and a floor line by default', async () => {
    render(<App port={seededPort()} createId={() => 'unused'} />)

    await screen.findByText('North Wall')

    // Ruler container present.
    const ruler = await screen.findByTestId('overlay-ruler')
    expect(ruler).toBeInTheDocument()
    // Ticks at 0, 50, 100, ..., 500 (wall width) on the horizontal axis.
    const horizontalTicks = ruler.querySelectorAll(
      '[data-tick-axis="horizontal"]',
    )
    const tickCms = Array.from(horizontalTicks).map((t) =>
      Number(t.getAttribute('data-tick-cm')),
    )
    expect(tickCms).toEqual([0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500])

    // Silhouette + floor line render to scale on the wall.
    const silhouette = screen.getByTestId('overlay-silhouette')
    expect(silhouette).toHaveAttribute('data-height-cm', '170')
    expect(screen.getByTestId('overlay-floor')).toBeInTheDocument()
  })

  it('toggles the ruler off and on via the sidebar; choice persists across reload', async () => {
    const user = userEvent.setup()
    const port = seededPort()
    const { unmount } = render(
      <App port={port} createId={() => 'unused'} />,
    )

    await screen.findByText('North Wall')
    expect(screen.getByTestId('overlay-ruler')).toBeInTheDocument()

    // Click the ruler toggle.
    await user.click(screen.getByLabelText(/ruler/i))
    await waitFor(() =>
      expect(screen.queryByTestId('overlay-ruler')).not.toBeInTheDocument(),
    )

    unmount()
    render(<App port={port} createId={() => 'unused'} />)
    await screen.findByText('North Wall')

    // Setting persisted; ruler still off after reload.
    expect(screen.queryByTestId('overlay-ruler')).not.toBeInTheDocument()
  })

  it('exports the active wall as a PNG download with the current arrangement', async () => {
    const user = userEvent.setup()
    const seeded = {
      photos: [
        { id: 'photo-1', filename: 'a.jpg', blobKey: 'b1', aspectRatio: 1 },
      ],
      walls: [{ id: 'w1', name: 'North Wall', widthCm: 500, heightCm: 300 }],
      placements: [
        {
          id: 'pl-1',
          photoId: 'photo-1',
          wallId: 'w1',
          xCm: 100,
          yCm: 100,
          longEdgeCm: 42,
        },
      ],
      ui: {
        activeWallId: 'w1',
        selectedPlacementId: 'pl-1',
        rulerEnabled: true,
        silhouetteEnabled: true,
      },
    }
    let capturedEl: HTMLElement | null = null
    let selectedAtCapture: boolean | null = null
    let placementInCapture: boolean | null = null
    const exportPort = {
      exportElement: async (el: HTMLElement) => {
        capturedEl = el
        const placement = el.querySelector('[data-testid="placement-pl-1"]')
        selectedAtCapture =
          placement?.getAttribute('data-selected') === 'true'
        placementInCapture = placement !== null
        return new Blob(['fake-png-bytes'], { type: 'image/png' })
      },
    }
    const downloaded: Array<{ blob: Blob; filename: string }> = []
    render(
      <App
        port={createMemoryStatePort(seeded)}
        blobStore={createMemoryBlobStore()}
        createId={() => 'unused'}
        imageOps={fakeImageOps}
        exportPort={exportPort}
        downloadBlob={(blob, filename) =>
          downloaded.push({ blob, filename })
        }
      />,
    )

    await screen.findByText('North Wall')

    await user.click(screen.getByRole('button', { name: /export png/i }))

    await waitFor(() => expect(downloaded).toHaveLength(1))
    expect(downloaded[0].blob.type).toBe('image/png')
    expect(downloaded[0].blob.size).toBeGreaterThan(0)
    expect(downloaded[0].filename).toMatch(/north-wall.*\.png$/i)
    // The exported element is the wall itself, captured without the
    // selection chrome (handles only render when selected), and the
    // current arrangement (the placement) is in the captured DOM.
    expect(capturedEl).not.toBeNull()
    expect(capturedEl!.getAttribute('data-testid')).toBe('wall')
    expect(selectedAtCapture).toBe(false)
    expect(placementInCapture).toBe(true)
  })

  it('toggles the silhouette + floor off and on via the sidebar', async () => {
    const user = userEvent.setup()
    render(<App port={seededPort()} createId={() => 'unused'} />)

    await screen.findByText('North Wall')
    expect(screen.getByTestId('overlay-silhouette')).toBeInTheDocument()
    expect(screen.getByTestId('overlay-floor')).toBeInTheDocument()

    await user.click(screen.getByLabelText(/silhouette/i))

    await waitFor(() =>
      expect(screen.queryByTestId('overlay-silhouette')).not.toBeInTheDocument(),
    )
    expect(screen.queryByTestId('overlay-floor')).not.toBeInTheDocument()
  })
})
