import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiProviderRegistry } from '../ai/AIProvider'
import { createInitialWorkspace } from '../domain/seed'
import GraphIntelligence from './GraphIntelligence'

describe('Graph Intelligence workspace', () => {
  beforeEach(() => {
    aiProviderRegistry.setProvider(null)
  })

  it('shows honest offline analytics and the exact unconfigured AI state', async () => {
    const workspace = createInitialWorkspace()
    render(<GraphIntelligence workspace={workspace} onOpenNode={() => undefined} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Анализ графа' })).toBeInTheDocument()
    expect(screen.getByText('Поставщик ИИ не настроен.')).toBeInTheDocument()
    expect(screen.getByText(/не генерирует ответы ИИ/i)).toBeInTheDocument()

    const nodeStat = screen.getByText('Активные узлы').closest('.graph-stat') as HTMLElement
    await waitFor(() => expect(within(nodeStat).getByText('9')).toBeInTheDocument())
    const connectionStat = screen.getByText('Связи').closest('.graph-stat') as HTMLElement
    expect(within(connectionStat).getByText('10')).toBeInTheDocument()
    expect(screen.getByText('Точных совпадений названий нет.')).toBeInTheDocument()
  })

  it('analyzes immediate neighbors and highlights the actual incident links on the canvas', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    const onFocusGraphSelection = vi.fn()
    render(
      <GraphIntelligence
        workspace={workspace}
        onOpenNode={() => undefined}
        onFocusGraphSelection={onFocusGraphSelection}
      />,
    )

    const centerPicker = screen.getByRole('searchbox', { name: 'Центральный узел' })
    await user.click(centerPicker)
    await user.type(centerPicker, 'Нейро-холст')
    await user.click(screen.getByRole('option', { name: /Нейро-холст/ }))
    await user.click(screen.getByRole('button', { name: 'Анализировать' }))

    expect(await screen.findByText('Входящие связи от')).toBeInTheDocument()
    expect(screen.getByText('Исходящие связи к')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Подсветить на холсте' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Подсветить на холсте' }))
    expect(onFocusGraphSelection).toHaveBeenCalledWith(
      ['neural-canvas'],
      expect.arrayContaining(['e-systems-canvas', 'e-graph-canvas']),
    )
  })

  it('finds a real shortest path and reports when no provider is registered', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    const onFocusGraphSelection = vi.fn()
    render(
      <GraphIntelligence
        workspace={workspace}
        onOpenNode={() => undefined}
        onFocusGraphSelection={onFocusGraphSelection}
      />,
    )

    const findPathButton = screen.getByRole('button', { name: 'Найти путь' })
    await waitFor(() => expect(findPathButton).toBeEnabled())
    await user.click(findPathButton)
    expect(await screen.findByText(/1 связь · 2 узла/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Подсветить путь на холсте' }))
    expect(onFocusGraphSelection).toHaveBeenCalledWith(['neural-canvas', 'systems-thinking'], ['e-systems-canvas'])
    expect(screen.getByText('Поставщик ИИ не настроен.')).toBeInTheDocument()
  })
})
