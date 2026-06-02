import { describe, it, expect, beforeAll } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
})
