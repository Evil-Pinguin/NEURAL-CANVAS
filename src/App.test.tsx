import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import * as database from './data/database'
import { createWorkspaceExport } from './data/workspace-transfer'
import { workspaceSchema } from './domain/model'
import { createInitialWorkspace } from './domain/seed'
import App from './App'
import { useWorkspaceStore } from './store/workspace-store'

describe('Neural Canvas app shell', () => {
  it('opens the persisted canvas and exposes the global search shortcut', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'л', code: 'KeyK', ctrlKey: true })
    const search = await screen.findByRole('searchbox', { name: 'Поиск по холсту' })
    await waitFor(() => expect(search).toHaveFocus())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Поиск и команды' })).not.toBeInTheDocument()

    const searchTrigger = screen.getByRole('button', { name: 'Открыть поиск по рабочему пространству' })
    await user.click(searchTrigger)
    expect(await screen.findByRole('searchbox', { name: 'Поиск по холсту' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(searchTrigger).toHaveFocus()
  })

  it('creates and selects a new thought from the canvas toolbar', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })).toBeInTheDocument()
    await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })
    const initialEdgeCount = useWorkspaceStore.getState().workspace.edges.length
    await user.click(screen.getByRole('button', { name: 'Новый объект' }))
    expect(useWorkspaceStore.getState().workspace.nodes).toHaveLength(10)
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdgeCount)
    expect(useWorkspaceStore.getState().selectedNodeId).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Настройки объекта' })).toBeInTheDocument()
    expect(await screen.findByLabelText('НАЗВАНИЕ')).toHaveValue('Новая идея')
  })

  it('keeps object details closed on selection until the corner button opens them', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    useWorkspaceStore.setState({ workspace, isReady: true, saveStatus: 'saved', selectedNodeId: null })
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })

    act(() => useWorkspaceStore.getState().setSelectedNodeId('systems-thinking'))
    expect(screen.queryByRole('complementary', { name: 'Сведения об объекте «Идеи становятся системами»' })).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Показать панель сведений' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(await screen.findByRole('complementary', { name: 'Сведения об объекте «Идеи становятся системами»' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скрыть панель сведений' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('creates a node from the canvas context menu without inventing a connection', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    const initialEdgeCount = useWorkspaceStore.getState().workspace.edges.length
    const pane = document.querySelector('.react-flow__pane')
    expect(pane).not.toBeNull()

    fireEvent.contextMenu(pane!, { clientX: 340, clientY: 260 })
    const contextMenu = await screen.findByRole('menu', { name: 'Контекстное меню холста' })
    await user.click(within(contextMenu).getByRole('menuitem', { name: 'Заметка здесь' }))

    const addedNode = useWorkspaceStore.getState().workspace.nodes.at(-1)
    expect(addedNode?.type).toBe('note')
    expect(addedNode?.title).toBe('Новая заметка')
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdgeCount)
    expect(screen.getByRole('button', { name: 'Центрировать граф' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Вместить граф в область просмотра' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Включить режим выделения' }))
    expect(screen.getByRole('button', { name: 'Выйти из режима выделения' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Выйти из режима выделения' }))
  })

  it('creates an idea when the user double-clicks empty canvas space', async () => {
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    const pane = document.querySelector('.react-flow__pane')
    expect(pane).not.toBeNull()
    const initialNodeCount = useWorkspaceStore.getState().workspace.nodes.length
    const initialEdges = useWorkspaceStore.getState().workspace.edges.length

    fireEvent.doubleClick(pane!, { clientX: 252, clientY: 242 })

    expect(useWorkspaceStore.getState().workspace.nodes).toHaveLength(initialNodeCount + 1)
    expect(useWorkspaceStore.getState().workspace.nodes.at(-1)?.type).toBe('idea')
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdges)
  })

  it('shows the real unsaved, saving, and saved-local states during persistence', async () => {
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    const status = await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })
    const originalWrite = database.writeWorkspace.bind(database)
    let releaseWrite: (() => void) | undefined
    let writeStarted = false
    const writeGate = new Promise<void>((resolve) => { releaseWrite = resolve })
    const writeSpy = vi.spyOn(database, 'writeWorkspace').mockImplementation(async (workspace) => {
      writeStarted = true
      await writeGate
      await originalWrite(workspace)
    })

    try {
      act(() => {
        useWorkspaceStore.getState().updateNode('neural-canvas', { description: 'A saved local edit.' })
      })
      expect(status).toHaveTextContent('Есть несохранённые изменения')
      await waitFor(() => expect(writeStarted).toBe(true), { timeout: 2000 })
      expect(status).toHaveTextContent('Сохранение…')
      releaseWrite?.()
      await waitFor(() => expect(status).toHaveTextContent('Сохранено на устройстве'), { timeout: 2000 })

      writeSpy.mockRejectedValueOnce(new Error('IndexedDB write failed'))
      act(() => {
        useWorkspaceStore.getState().updateNode('neural-canvas', { description: 'This write should fail.' })
      })
      expect(status).toHaveTextContent('Есть несохранённые изменения')
      await waitFor(() => expect(status).toHaveTextContent('Ошибка сохранения'), { timeout: 2000 })
      writeSpy.mockRestore()

      act(() => {
        useWorkspaceStore.getState().updateNode('neural-canvas', { description: 'Retry saved locally.' })
      })
      await waitFor(() => expect(status).toHaveTextContent('Сохранено на устройстве'), { timeout: 2000 })
    } finally {
      releaseWrite?.()
      writeSpy.mockRestore()
    }
  })

  it('creates and switches between local workspaces from the top navigation', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })

    await user.click(screen.getByRole('button', { name: 'Переключить рабочее пространство. Сейчас открыто: Продуктовое мышление' }))
    expect(screen.getByRole('dialog', { name: 'Переключение рабочего пространства' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Создать рабочее пространство' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Новое рабочее пространство' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Переключить рабочее пространство. Сейчас открыто: Новое рабочее пространство' }))
    await user.click(screen.getByRole('button', { name: 'Продуктовое мышление' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })).toBeInTheDocument()
  })

  it('opens every sidebar view, filters items, and collapses the navigation', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    const pages = screen.getByRole('navigation', { name: 'Разделы рабочего пространства' })
    const library = screen.getByRole('navigation', { name: 'Библиотека и история' })

    for (const [nav, label, heading] of [
      [pages, 'Обзор', 'Обзор'],
      [pages, 'Холст', 'Продуктовое мышление'],
      [pages, 'Анализ графа', 'Анализ графа'],
      [pages, 'База знаний', 'База знаний'],
      [pages, 'Проекты', 'Проекты'],
      [pages, 'Задачи', 'Задачи'],
      [pages, 'Заметки', 'Заметки'],
      [library, 'Недавние', 'Недавние'],
      [library, 'Избранное', 'Избранное'],
      [library, 'Корзина', 'Корзина'],
    ] as const) {
      await user.click(within(nav).getByRole('button', { name: label }))
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    }

    await user.selectOptions(screen.getByRole('combobox', { name: 'Фильтр по типу' }), 'note')
    await user.type(screen.getByRole('searchbox', { name: 'Поиск по рабочему пространству' }), 'обучения')
    await user.click(within(pages).getByRole('button', { name: 'База знаний' }))
    expect(screen.getByText('Дневник обучения')).toBeInTheDocument()
    expect(screen.queryByText('Идеи становятся системами')).not.toBeInTheDocument()

    const sidebar = screen.getByRole('complementary', { name: 'Навигация по рабочему пространству' })
    await user.click(screen.getByRole('button', { name: 'Свернуть боковую панель' }))
    expect(sidebar).toHaveClass('is-collapsed')
    await user.click(screen.getByRole('button', { name: 'Развернуть боковую панель' }))
    expect(sidebar).not.toHaveClass('is-collapsed')
  })

  it('opens settings, help, and the local profile menu', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })

    await user.click(screen.getByRole('button', { name: 'Настройки' }))
    expect(screen.getByRole('dialog', { name: 'Настройки рабочего пространства' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Импортировать рабочее пространство из JSON-файла' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Экспортировать рабочее пространство в JSON-файл' })).toBeInTheDocument()
    const defaultView = screen.getByRole('combobox', { name: 'Стартовый раздел рабочего пространства' })
    await user.selectOptions(defaultView, 'developer')
    expect(useWorkspaceStore.getState().workspace.settings.defaultView).toBe('developer')
    const workspaceName = screen.getByLabelText('НАЗВАНИЕ РАБОЧЕГО ПРОСТРАНСТВА')
    await user.clear(workspaceName)
    await user.type(workspaceName, 'Personal space')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Personal space' })).toBeInTheDocument()
    await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })

    await user.click(screen.getByRole('button', { name: 'Справка' }))
    expect(screen.getByRole('dialog', { name: 'Справка и сочетания клавиш' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Закрыть меню' }))

    await user.click(screen.getByRole('button', { name: 'Меню локального профиля' }))
    expect(screen.getByRole('dialog', { name: 'Локальный профиль' })).toBeInTheDocument()
    expect(screen.getByText(/Данные рабочего пространства остаются в этом браузере/)).toBeInTheDocument()
  })

  it('edits inspector metadata in the real workspace, duplicates without links, and trashes the copy', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    useWorkspaceStore.setState({
      workspace,
      workspaces: [{ id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt }],
      isReady: true,
      saveStatus: 'saved',
      selectedNodeId: null,
    })
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    act(() => useWorkspaceStore.getState().setSelectedNodeId('systems-thinking'))
    await user.click(screen.getByRole('button', { name: 'Показать панель сведений' }))
    const title = await screen.findByLabelText('НАЗВАНИЕ')
    const initialEdgeCount = useWorkspaceStore.getState().workspace.edges.length
    expect(screen.getByRole('button', { name: 'Открыть исходящую связь к объекту «Нейро-холст»; подпись: Формирует рабочее пространство' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Открыть входящую связь от объекта «Зафиксировать идею»; подпись: Начинается с идеи' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Удалить связь с объектом «Нейро-холст»' }))
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdgeCount - 1)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Тип отношения' }), 'supports')
    await user.clear(screen.getByRole('textbox', { name: 'Подпись связи' }))
    await user.type(screen.getByRole('textbox', { name: 'Подпись связи' }), 'Reinforces')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Объект для связи' }), 'knowledge-graph')
    await user.click(screen.getByRole('button', { name: 'Добавить связь' }))
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdgeCount)
    expect(useWorkspaceStore.getState().workspace.edges).toContainEqual(expect.objectContaining({
      sourceId: 'systems-thinking',
      targetId: 'knowledge-graph',
      relationType: 'supports',
      label: 'Reinforces',
    }))
    expect(screen.getByText('Reinforces')).toBeInTheDocument()

    await user.clear(title)
    await user.type(title, 'Inspector edited thought')
    await user.tab()
    await user.clear(screen.getByLabelText('ОПИСАНИЕ'))
    await user.type(screen.getByLabelText('ОПИСАНИЕ'), 'Saved directly to the active workspace.')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Тип объекта' }), 'note')
    await user.click(screen.getByRole('button', { name: 'Выбрать цвет: Розовый' }))
    await user.type(screen.getByRole('textbox', { name: 'Добавить тег' }), 'inspector-check{Enter}')

    await user.type(screen.getByRole('textbox', { name: 'Название свойства' }), 'Source')
    await user.type(screen.getByRole('textbox', { name: 'Значение свойства' }), 'Inspector test')
    await user.click(screen.getByRole('button', { name: 'Добавить свойство' }))
    const propertyNameInput = screen.getByRole('textbox', { name: 'Название свойства «Source»' })
    await user.clear(propertyNameInput)
    await user.type(propertyNameInput, 'Origin')
    await user.tab()
    await user.clear(screen.getByRole('textbox', { name: 'Значение свойства «Origin»' }))
    await user.type(screen.getByRole('textbox', { name: 'Значение свойства «Origin»' }), 'Edited in inspector')
    fireEvent.change(screen.getByLabelText('Дата создания'), { target: { value: '2021-06-07T08:09' } })
    fireEvent.change(screen.getByLabelText('Дата изменения'), { target: { value: '2022-09-08T10:11' } })

    const edited = useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'systems-thinking')!
    expect(edited).toMatchObject({
      title: 'Inspector edited thought',
      description: 'Saved directly to the active workspace.',
      type: 'note',
      color: 'rose',
      tags: expect.arrayContaining(['inspector-check']),
      createdAt: new Date('2021-06-07T08:09').toISOString(),
      updatedAt: new Date('2022-09-08T10:11').toISOString(),
      properties: [expect.objectContaining({ name: 'Origin', value: 'Edited in inspector' })],
    })

    await user.click(screen.getByRole('button', { name: 'Добавить «Inspector edited thought» в избранное' }))
    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'systems-thinking')?.favorite).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Создать копию объекта «Inspector edited thought»' }))

    const duplicate = useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === useWorkspaceStore.getState().selectedNodeId)!
    expect(duplicate).toMatchObject({ title: 'Inspector edited thought (копия)', type: 'note', color: 'rose', favorite: false })
    expect(duplicate.properties?.[0]).toMatchObject({ name: 'Origin', value: 'Edited in inspector' })
    expect(duplicate.properties?.[0]?.id).not.toBe(edited.properties?.[0]?.id)
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdgeCount)
    expect(useWorkspaceStore.getState().workspace.edges.some((edge) => edge.sourceId === duplicate.id || edge.targetId === duplicate.id)).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Свернуть панель сведений' }))
    expect(screen.queryByRole('complementary', { name: 'Сведения об объекте «Inspector edited thought (копия)»' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Показать панель сведений' }))
    fireEvent.click(screen.getByRole('button', { name: 'Переместить в корзину' }))
    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === duplicate.id)?.deletedAt).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Объект не выбран' })).toBeInTheDocument()
  }, 60_000)

  it('edits and persists the caption of an existing connection', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    useWorkspaceStore.setState({
      workspace,
      workspaces: [{ id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt }],
      isReady: true,
      saveStatus: 'saved',
      selectedNodeId: null,
    })
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    act(() => useWorkspaceStore.getState().setSelectedNodeId('connection-hints'))
    await user.click(screen.getByRole('button', { name: 'Показать панель сведений' }))
    expect(await screen.findByRole('button', { name: 'Открыть исходящую связь к объекту «Граф знаний»; подпись: Раскрывает структуру' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Изменить подпись связи с объектом «Граф знаний»' }))
    const caption = screen.getByRole('textbox', { name: 'Подпись связи с объектом «Граф знаний»' })
    await user.clear(caption)
    await user.type(caption, 'Показывает связи идей')
    await user.click(screen.getByRole('button', { name: 'Сохранить подпись связи с объектом «Граф знаний»' }))
    expect(screen.getByRole('button', { name: 'Изменить подпись связи с объектом «Граф знаний»' })).toHaveFocus()

    expect(useWorkspaceStore.getState().workspace.edges.find((edge) => edge.id === 'e-hints-graph')?.label).toBe('Показывает связи идей')
    expect(screen.getByRole('button', { name: 'Открыть исходящую связь к объекту «Граф знаний»; подпись: Показывает связи идей' })).toBeInTheDocument()
    expect(screen.getAllByText('Показывает связи идей').length).toBeGreaterThan(0)
  })

  it('shows custom connection captions in the knowledge-base preview', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    const workspaceWithCustomCaption = {
      ...workspace,
      edges: workspace.edges.map((edge) => edge.id === 'e-hints-graph' ? { ...edge, label: 'Показывает связи идей' } : edge),
    }
    useWorkspaceStore.setState({
      workspace: workspaceWithCustomCaption,
      workspaces: [{ id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt }],
      isReady: true,
      saveStatus: 'saved',
      selectedNodeId: null,
    })
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    const pages = screen.getByRole('navigation', { name: 'Разделы рабочего пространства' })
    await user.click(within(pages).getByRole('button', { name: 'База знаний' }))
    await screen.findByRole('heading', { level: 1, name: 'База знаний' })
    await user.click(screen.getByRole('button', { name: 'Предпросмотр «Подсказки о связях»' }))
    expect(screen.getByText('Исходящая · Показывает связи идей')).toBeInTheDocument()
  })

  it('commits inspector text drafts when switching panels', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    useWorkspaceStore.setState({
      workspace,
      workspaces: [{ id: workspace.id, name: workspace.name, updatedAt: workspace.updatedAt }],
      isReady: true,
      saveStatus: 'saved',
      selectedNodeId: null,
    })
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    act(() => useWorkspaceStore.getState().setSelectedNodeId('systems-thinking'))
    await user.click(screen.getByRole('button', { name: 'Показать панель сведений' }))

    const title = await screen.findByLabelText('НАЗВАНИЕ')
    await user.clear(title)
    await user.type(title, 'A title that survives navigation')
    await user.type(screen.getByRole('textbox', { name: 'Добавить тег' }), 'retained-tag')
    await user.type(screen.getByRole('textbox', { name: 'Название свойства' }), 'Draft source')
    await user.type(screen.getByRole('textbox', { name: 'Значение свойства' }), 'Saved on blur')
    const pages = screen.getByRole('navigation', { name: 'Разделы рабочего пространства' })
    await user.click(within(pages).getByRole('button', { name: 'База знаний' }))

    const edited = useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'systems-thinking')
    expect(edited).toMatchObject({
      title: 'A title that survives navigation',
      tags: expect.arrayContaining(['retained-tag']),
      properties: [expect.objectContaining({ name: 'Draft source', value: 'Saved on blur' })],
    })
    await user.click(within(pages).getByRole('button', { name: 'Холст' }))
    act(() => useWorkspaceStore.getState().setSelectedNodeId('systems-thinking'))
    expect(await screen.findByLabelText('НАЗВАНИЕ')).toHaveValue('A title that survives navigation')
  })

  it('opens the workspace overview from the corner button and can close it again', async () => {
    const user = userEvent.setup()
    const workspace = createInitialWorkspace()
    useWorkspaceStore.setState({ workspace, isReady: true, saveStatus: 'saved', selectedNodeId: null })
    render(<App />)

    expect(screen.queryByRole('heading', { name: 'Объект не выбран' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Показать панель сведений' }))
    expect(await screen.findByRole('heading', { name: 'Объект не выбран' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Свернуть панель сведений' }))
    expect(screen.queryByRole('complementary', { name: 'Сведения о рабочем пространстве' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Показать панель сведений' }))
    expect(await screen.findByRole('heading', { name: 'Объект не выбран' })).toBeInTheDocument()
  })

  it('creates a Markdown note from the keyboard command palette and keeps its links explicit', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const palette = await screen.findByRole('dialog', { name: 'Поиск и команды' })
    const initialEdgeCount = useWorkspaceStore.getState().workspace.edges.length
    await user.click(within(palette).getByRole('option', { name: /Создать заметку/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Заметки' })).toBeInTheDocument()
    const created = useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === useWorkspaceStore.getState().selectedNodeId)
    expect(created).toMatchObject({ type: 'note', title: 'Новая заметка', markdownContent: '' })
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdgeCount)
    expect(screen.getByRole('textbox', { name: 'Текст заметки в формате Markdown' })).toBeInTheDocument()
  })

  it('runs a quick command with the palette arrow and enter keys', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const search = await screen.findByRole('searchbox', { name: 'Поиск по холсту' })
    await waitFor(() => expect(search).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /Создать проект/ })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Разработка' })).toBeInTheDocument()
    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === useWorkspaceStore.getState().selectedNodeId)).toMatchObject({ type: 'project', title: 'Новый проект' })
  })

  it('opens a global search match in the canvas inspector', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Продуктовое мышление' })
    await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const search = await screen.findByRole('searchbox', { name: 'Поиск по холсту' })
    await user.type(search, 'конфиденциальность')
    await user.click(await screen.findByRole('option', { name: /Данные хранятся на устройстве/ }))

    expect(await screen.findByLabelText('НАЗВАНИЕ')).toHaveValue('Данные хранятся на устройстве')
    expect(screen.getByRole('complementary', { name: 'Сведения об объекте «Данные хранятся на устройстве»' })).toBeInTheDocument()
  })


  it('requires explicit confirmation before replacing and keeps an automatic backup', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })
    const current = useWorkspaceStore.getState().workspace
    const imported = {
      ...current,
      id: 'workspace-external-backup',
      name: 'Imported replacement',
      nodes: current.nodes.map((node) => node.id === 'systems-thinking' ? { ...node, title: 'Imported thought' } : node),
    }
    const file = new File([JSON.stringify(createWorkspaceExport(imported))], 'replacement.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Выберите файл рабочего пространства'), { target: { files: [file] } })

    const dialog = await screen.findByRole('dialog', { name: 'Импорт рабочего пространства' })
    expect(within(dialog).getByText(/настройки и избранное тоже сохранены/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: /Заменить текущее пространство/ }))
    const confirm = within(dialog).getByRole('button', { name: 'Подтвердить замену' })
    expect(confirm).toBeDisabled()
    expect(useWorkspaceStore.getState().workspace.name).toBe(current.name)

    await user.click(within(dialog).getByRole('checkbox', { name: /Понимаю, заменить это рабочее пространство/ }))
    await user.click(confirm)
    await waitFor(() => expect(useWorkspaceStore.getState().workspace.name).toBe('Imported replacement'))

    const stored = (await database.readWorkspaces()).map((item) => workspaceSchema.parse(item))
    const backup = stored.find((item) => item.id.startsWith('workspace-backup-'))
    expect(backup?.name).toContain('(резервная копия')
    expect(backup?.nodes.find((node) => node.id === 'systems-thinking')?.title)
      .toBe(current.nodes.find((node) => node.id === 'systems-thinking')?.title)
    expect(await screen.findByText(/Автоматическая резервная копия сохранена/)).toBeInTheDocument()
  })

  it('shows validation errors and cancel leaves the active workspace unchanged', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('status', { name: 'Состояние сохранения: Сохранено на устройстве' })
    const before = useWorkspaceStore.getState().workspace
    const malformed = new File(['{"nodes": []}'], 'broken.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Выберите файл рабочего пространства'), { target: { files: [malformed] } })

    const dialog = await screen.findByRole('dialog', { name: 'Не удалось импортировать файл' })
    expect(within(dialog).getByText('Данные не изменены.')).toBeInTheDocument()
    expect(within(dialog).getByText(/идентификатор: обязательное поле не заполнено/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Закрыть окно импорта' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Не удалось импортировать файл' })).not.toBeInTheDocument()
    expect(useWorkspaceStore.getState().workspace).toEqual(before)
  })

})
