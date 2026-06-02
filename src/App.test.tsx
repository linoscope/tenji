import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createMemoryStatePort } from './storage/port'
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
})
