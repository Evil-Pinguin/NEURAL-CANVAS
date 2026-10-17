import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import { useWorkspaceStore } from '../store/workspace-store'
import ConnectionLabelDialog from './ConnectionLabelDialog'

describe('переименование связи', () => {
  it('сохраняет новую подпись, не меняя тип отношения', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    const edge = workspace.edges.find((item) => item.id === 'e-systems-canvas')!
    const onClose = vi.fn()
    useWorkspaceStore.setState({
      workspace,
      workspaces: [{ id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt }],
      isReady: true,
      saveStatus: 'saved',
      selectedNodeId: null,
    })

    render(<ConnectionLabelDialog edge={edge} onClose={onClose} />)
    const input = screen.getByRole('textbox', { name: 'Подпись связи' })
    expect(input).toHaveValue('Формирует рабочее пространство')
    expect(input).toHaveFocus()

    await user.clear(input)
    expect(screen.getByRole('button', { name: 'Сохранить подпись' })).toBeDisabled()
    expect(screen.getByText('Введите подпись длиной не более 80 символов.')).toBeInTheDocument()
    await user.type(input, 'Создаёт основу проекта')
    await user.click(screen.getByRole('button', { name: 'Сохранить подпись' }))

    expect(useWorkspaceStore.getState().workspace.edges.find((item) => item.id === edge.id)).toMatchObject({
      label: 'Создаёт основу проекта',
      relationType: 'supports',
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('закрывается клавишей Escape без сохранения черновика', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    const edge = workspace.edges.find((item) => item.id === 'e-systems-canvas')!
    const onClose = vi.fn()
    useWorkspaceStore.setState({ workspace, isReady: true, saveStatus: 'saved' })

    render(<ConnectionLabelDialog edge={edge} onClose={onClose} />)
    await user.clear(screen.getByRole('textbox', { name: 'Подпись связи' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
    expect(useWorkspaceStore.getState().workspace.edges.find((item) => item.id === edge.id)?.label)
      .toBe('Формирует рабочее пространство')
  })
})
