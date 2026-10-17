import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import { useWorkspaceStore } from '../store/workspace-store'
import CommandPalette from './CommandPalette'
import WorkspaceViews from './WorkspaceViews'

function TestTaskView({ query = '' }: { query?: string }) {
  const currentWorkspace = useWorkspaceStore((state) => state.workspace)
  return <WorkspaceViews view="tasks" workspace={currentWorkspace} query={query} filters={{ kind: 'all', status: 'all' }} onCreate={() => undefined} onOpenNode={() => undefined} />
}

function TestKnowledgeView({ onOpenNode = () => undefined }: { onOpenNode?: (id: string) => void }) {
  const currentWorkspace = useWorkspaceStore((state) => state.workspace)
  const [query, setQuery] = useState('')
  return (
    <WorkspaceViews
      view="knowledge"
      workspace={currentWorkspace}
      query={query}
      filters={{ kind: 'all', status: 'all' }}
      onQueryChange={setQuery}
      onCreate={(type) => { useWorkspaceStore.getState().addNode(type, { x: 1100, y: 760 }) }}
      onOpenNode={onOpenNode}
    />
  )
}

function TestDeveloperView() {
  const currentWorkspace = useWorkspaceStore((state) => state.workspace)
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId)
  const [query, setQuery] = useState('')
  return <WorkspaceViews view="developer" workspace={currentWorkspace} query={query} filters={{ kind: 'all', status: 'all' }} onQueryChange={setQuery} onCreate={(type) => { useWorkspaceStore.getState().addNode(type, { x: 1200, y: 900 }) }} onOpenNode={() => undefined} selectedNodeId={selectedNodeId} />
}

function TestNotesView({ onOpenNode = () => undefined }: { onOpenNode?: (id: string) => void }) {
  const currentWorkspace = useWorkspaceStore((state) => state.workspace)
  const [query, setQuery] = useState('')
  return <WorkspaceViews view="notes" workspace={currentWorkspace} query={query} filters={{ kind: 'all', status: 'all' }} onQueryChange={setQuery} onCreate={(type) => { useWorkspaceStore.getState().addNode(type, { x: 1200, y: 900 }) }} onOpenNode={onOpenNode} />
}

describe('Tasks workspace', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspace: createInitialWorkspace(), selectedNodeId: null })
  })

  it('moves a task between columns and keeps the store in sync', async () => {
    const user = userEvent.setup()
    render(<TestTaskView />)
    const inProgressColumn = screen.getByRole('heading', { name: 'В работе' }).closest('.task-column')
    expect(inProgressColumn).not.toBeNull()
    const doneButton = within(inProgressColumn as HTMLElement).getByRole('button', { name: 'Завершить' })
    await user.click(doneButton)

    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'capture-idea')?.status).toBe('done')
    expect(await within(inProgressColumn as HTMLElement).findByText('Задач пока нет')).toBeInTheDocument()
  })

  it('filters the task board using the global query', () => {
    render(<TestTaskView query="исследовать" />)
    expect(screen.getByRole('heading', { name: 'Исследовать связь' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Зафиксировать идею' })).not.toBeInTheDocument()
  })

  it('persists a Kanban drag-and-drop move to the real task status', async () => {
    const user = userEvent.setup()
    render(<TestDeveloperView />)
    await user.click(screen.getByRole('tab', { name: /Задачи/ }))

    const card = screen.getByLabelText('Карточка задачи «Зафиксировать идею»')
    const doneColumn = screen.getByRole('region', { name: 'Задачи: Готово' })
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(() => 'capture-idea'), effectAllowed: 'move' }
    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.drop(doneColumn, { dataTransfer })

    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'capture-idea')).toMatchObject({ taskStatus: 'done', status: 'done' })
    expect(await within(doneColumn).findByRole('button', { name: 'Зафиксировать идею' })).toBeInTheDocument()
  })

  it('edits project metadata and explicitly links a related idea', async () => {
    const user = userEvent.setup()
    let relatedIdeaId = ''
    act(() => { relatedIdeaId = useWorkspaceStore.getState().addNode('idea', { x: 1500, y: 1000 }).id })
    render(<TestDeveloperView />)
    await user.click(screen.getByRole('button', { name: 'Просмотреть проект «Нейро-холст»' }))

    const details = screen.getByRole('complementary', { name: 'Сведения о проекте «Нейро-холст»' })
    await user.selectOptions(within(details).getByRole('combobox', { name: 'Статус проекта' }), 'on-hold')
    await user.type(within(details).getByRole('textbox', { name: 'Добавить технологию' }), 'Vitest')
    await user.keyboard('{Enter}')
    await user.selectOptions(within(details).getByRole('combobox', { name: 'Выбрать идею или объект базы знаний для связи' }), relatedIdeaId)
    await user.click(within(details).getByRole('button', { name: 'Связать с выбранной идеей или объектом базы знаний' }))

    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === 'neural-canvas')).toMatchObject({ projectStatus: 'on-hold', techStack: expect.arrayContaining(['Vitest']) })
    expect(useWorkspaceStore.getState().workspace.edges).toContainEqual(expect.objectContaining({ sourceId: 'neural-canvas', targetId: relatedIdeaId, relationType: 'references' }))
  })
})

describe('Knowledge Base', () => {
  beforeEach(() => {
    const workspace = createInitialWorkspace()
    useWorkspaceStore.setState({ workspace, selectedNodeId: null })
  })

  it('provides grid, list, graph, and a quick preview with related objects', async () => {
    const user = userEvent.setup()
    const onOpenNode = vi.fn()
    render(<TestKnowledgeView onOpenNode={onOpenNode} />)

    expect(screen.getByRole('heading', { level: 1, name: 'База знаний' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Предпросмотр «Граф знаний»' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Предпросмотр «Граф знаний»' }))
    const preview = screen.getByRole('complementary', { name: 'Быстрый просмотр: Граф знаний' })
    expect(within(preview).getByText('Нейро-холст')).toBeInTheDocument()
    expect(within(preview).getByText('Связанные объекты')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Список' }))
    expect(screen.getByRole('list', { name: 'Список базы знаний' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Граф' }))
    expect(screen.getByRole('application', { name: 'Холст графа базы знаний' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Быстрый просмотр: Граф знаний' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Открыть на холсте' }))
    expect(onOpenNode).toHaveBeenCalledWith('knowledge-graph')
  })

  it('searches title, description, and tags; filters by type, date, and favorite; and sorts', async () => {
    const user = userEvent.setup()
    act(() => useWorkspaceStore.getState().toggleFavorite('systems-thinking'))
    render(<TestKnowledgeView />)
    const search = screen.getByRole('searchbox', { name: 'Поиск по базе знаний' })

    await user.type(search, 'архитектура')
    expect(screen.getByRole('button', { name: 'Предпросмотр «Граф знаний»' })).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'конфиденциальность')
    expect(screen.getByRole('button', { name: 'Предпросмотр «Данные хранятся на устройстве»' })).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'принцип')
    expect(screen.getByRole('button', { name: 'Предпросмотр «Идеи становятся системами»' })).toBeInTheDocument()

    await user.clear(search)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Фильтр базы знаний по типу' }), 'note')
    expect(screen.getByRole('button', { name: 'Предпросмотр «Дневник обучения»' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Предпросмотр «Граф знаний»' })).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Изменено после'))
    await user.type(screen.getByLabelText('Изменено после'), '2099-01-01')
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры базы знаний' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Сортировка базы знаний' }), 'title-asc')
    await user.click(screen.getByRole('button', { name: 'Показывать только избранное' }))
    expect(screen.getByRole('button', { name: 'Предпросмотр «Идеи становятся системами»' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Предпросмотр «Граф знаний»' })).not.toBeInTheDocument()
  })

  it('creates a selected knowledge item, edits it in quick view, adds a note, and opens it on canvas', async () => {
    const user = userEvent.setup()
    const onOpenNode = vi.fn()
    render(<TestKnowledgeView onOpenNode={onOpenNode} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Тип нового объекта' }), 'question')
    await user.click(screen.getByRole('button', { name: 'Новый объект' }))

    expect(screen.getByRole('complementary', { name: 'Быстрый просмотр: Новый вопрос' })).toBeInTheDocument()
    const created = useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === useWorkspaceStore.getState().selectedNodeId)
    expect(created).toMatchObject({ type: 'question', title: 'Новый вопрос', favorite: false })

    await user.click(screen.getByRole('button', { name: 'Изменить' }))
    const title = screen.getByRole('textbox', { name: 'Название объекта базы знаний' })
    await user.clear(title)
    await user.type(title, 'Research question')
    const note = screen.getByRole('textbox', { name: 'Заметка для «Research question»' })
    await user.type(note, 'A note written in the knowledge preview.')
    await user.click(screen.getByRole('button', { name: 'Выбрать цвет: Розовый' }))
    await user.type(screen.getByRole('textbox', { name: 'Добавить тег базы знаний' }), 'research')
    await user.keyboard('{Enter}')
    const preview = screen.getByRole('complementary', { name: 'Быстрый просмотр: Research question' })
    await user.click(within(preview).getByRole('button', { name: 'Добавить «Research question» в избранное' }))

    const updated = useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === created?.id)
    expect(updated).toMatchObject({
      title: 'Research question',
      description: 'A note written in the knowledge preview.',
      color: 'rose',
      tags: ['research'],
      favorite: true,
    })
    await user.click(screen.getByRole('button', { name: 'Открыть на холсте' }))
    expect(onOpenNode).toHaveBeenCalledWith(created?.id)
  })
})

describe('Markdown notes editor', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspace: createInitialWorkspace(), selectedNodeId: null })
  })

  it('autosaves Markdown, renders a safe preview, and creates only explicitly requested links', async () => {
    const user = userEvent.setup()
    render(<TestNotesView />)
    const initialEdgeCount = useWorkspaceStore.getState().workspace.edges.length
    await user.click(screen.getByRole('button', { name: 'Новая заметка' }))

    const noteId = useWorkspaceStore.getState().selectedNodeId!
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdgeCount)
    const markdown = '# Safety notes\n\n- [ ] Draft the page\n- [x] Review the source\n\n[Guide](https://example.com)\n\n[Unsafe](javascript:alert)\n\n<img src=x onerror=alert(1)>'
    fireEvent.change(screen.getByRole('textbox', { name: 'Текст заметки в формате Markdown' }), { target: { value: markdown } })
    expect(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === noteId)?.markdownContent).toBe(markdown)

    await user.click(screen.getByRole('button', { name: 'Предпросмотр' }))
    const preview = screen.getByLabelText('Предпросмотр Markdown')
    expect(within(preview).getByRole('heading', { level: 1, name: 'Safety notes' })).toBeInTheDocument()
    expect(within(preview).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(preview).getByRole('link', { name: 'Guide' })).toHaveAttribute('href', 'https://example.com/')
    expect(within(preview).queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument()
    expect(preview.querySelector('img')).toBeNull()
    expect(within(preview).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Выбрать объект для связи с заметкой' }), 'systems-thinking')
    await user.click(screen.getByRole('button', { name: 'Связать объект' }))
    expect(useWorkspaceStore.getState().workspace.edges).toHaveLength(initialEdgeCount + 1)
    expect(useWorkspaceStore.getState().workspace.edges.at(-1)).toMatchObject({ sourceId: noteId, targetId: 'systems-thinking', relationType: 'related_to' })
  })
})

describe('Global command palette', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspace: createInitialWorkspace(), selectedNodeId: null })
  })

  it('highlights global matches, filters result types, opens objects, and runs quick commands', async () => {
    const user = userEvent.setup()
    const workspace = useWorkspaceStore.getState().workspace
    const onOpenNode = vi.fn()
    const onOpenArchitectureNote = vi.fn()
    const onCommand = vi.fn()
    const onClose = vi.fn()
    const props = { workspace, onQueryChange: vi.fn(), onClose, onOpenNode, onOpenArchitectureNote, onCommand }
    const { rerender } = render(<CommandPalette {...props} query="зафиксировать" />)

    const taskResult = screen.getByRole('option', { name: /Зафиксировать идею/ })
    expect(taskResult.querySelector('mark')).toHaveTextContent('Зафиксировать')
    await user.click(taskResult)
    expect(onOpenNode).toHaveBeenCalledWith('capture-idea')

    rerender(<CommandPalette {...props} query="" />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Фильтр результатов по типу' }), 'project')
    expect(screen.getByRole('option', { name: /Нейро-холст/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Зафиксировать идею/ })).not.toBeInTheDocument()

    rerender(<CommandPalette {...props} query="без интернета" />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Фильтр результатов по типу' }), 'architecture-note')
    await user.click(screen.getByRole('option', { name: /Хранить данные рабочего пространства/ }))
    expect(onOpenArchitectureNote).toHaveBeenCalledWith('architecture-local-first')

    rerender(<CommandPalette {...props} query="" />)
    await user.click(screen.getByRole('option', { name: /Создать заметку/ }))
    expect(onCommand).toHaveBeenCalledWith('create-note', '')
    expect(onClose).toHaveBeenCalled()
  })
})
