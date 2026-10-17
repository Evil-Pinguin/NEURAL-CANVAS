import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react'
import {
  Bold,
  BookOpen,
  CheckSquare,
  ChevronRight,
  Code2,
  Copy,
  Heading2,
  Italic,
  Link2,
  List as ListIcon,
  ListOrdered,
  Network,
  Plus,
  Search,
  StickyNote,
  X,
} from 'lucide-react'
import type { CanvasEdgeData, CanvasNodeData, NodeKind, Workspace, WorkspaceFilters } from '../domain/model'
import { getRelationCaption, kindLabels } from '../domain/model'
import { useWorkspaceStore } from '../store/workspace-store'
import { matchesNode } from '../utils/search'
import { formatRussianCount, formatRussianDate } from '../utils/locale'

type NotesEditorProps = {
  workspace: Workspace
  query: string
  filters: WorkspaceFilters
  onQueryChange?: (query: string) => void
  onCreate: (type: NodeKind) => void
  onOpenNode: (id: string) => void
}

type NoteLink = { edge: CanvasEdgeData; node: CanvasNodeData }

export default function NotesEditor({ workspace, query, filters, onQueryChange, onCreate, onOpenNode }: NotesEditorProps) {
  const updateNode = useWorkspaceStore((state) => state.updateNode)
  const addEdge = useWorkspaceStore((state) => state.addEdge)
  const deleteEdge = useWorkspaceStore((state) => state.deleteEdge)
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId)
  const saveStatus = useWorkspaceStore((state) => state.saveStatus)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [linkDraft, setLinkDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const allNotes = useMemo(() => workspace.nodes
    .filter((node) => !node.deletedAt && node.type === 'note')
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)), [workspace.nodes])
  const filteredNotes = useMemo(() => allNotes.filter((node) => matchesNode(node, query, filters)), [allNotes, query, filters])
  const notes = useMemo(() => {
    const activeId = selectedNoteId ?? selectedNodeId
    const active = activeId ? allNotes.find((node) => node.id === activeId) : undefined
    return active && !filteredNotes.some((node) => node.id === active.id) ? [active, ...filteredNotes] : filteredNotes
  }, [allNotes, filteredNotes, selectedNoteId, selectedNodeId])
  const selectedNote = notes.find((node) => node.id === selectedNoteId)
    ?? notes.find((node) => node.id === selectedNodeId)
    ?? notes[0]
  const markdown = selectedNote?.markdownContent ?? selectedNote?.description ?? ''
  const links: NoteLink[] = selectedNote ? workspace.edges.flatMap((edge) => {
    const otherId = edge.sourceId === selectedNote.id ? edge.targetId : edge.targetId === selectedNote.id ? edge.sourceId : null
    const node = otherId ? workspace.nodes.find((item) => item.id === otherId && !item.deletedAt) : null
    return node ? [{ edge, node }] : []
  }) : []
  const linkedIds = new Set(links.map((link) => link.node.id))
  const linkCandidates = workspace.nodes.filter((node) => !node.deletedAt && node.id !== selectedNote?.id && !linkedIds.has(node.id))

  useEffect(() => {
    setSelectedNoteId(selectedNote?.id ?? null)
    setTitleDraft(selectedNote?.title ?? '')
    setLinkDraft('')
    setMode('write')
  }, [selectedNote?.id])

  const createNote = () => {
    onCreate('note')
    const id = useWorkspaceStore.getState().selectedNodeId
    if (id) {
      setSelectedNoteId(id)
      setTitleDraft(useWorkspaceStore.getState().workspace.nodes.find((node) => node.id === id)?.title ?? 'Новая заметка')
      setMode('write')
    }
  }

  const updateTitle = (value: string) => {
    setTitleDraft(value)
    if (selectedNote && value.trim()) updateNode(selectedNote.id, { title: value })
  }
  const commitTitle = () => {
    if (!selectedNote) return
    const value = titleDraft.trim() || 'Новая заметка'
    setTitleDraft(value)
    if (value !== selectedNote.title) updateNode(selectedNote.id, { title: value })
  }

  const insertMarkdown = (before: string, after = '', placeholder = 'текст') => {
    if (!selectedNote) return
    const editor = editorRef.current
    const current = selectedNote.markdownContent ?? selectedNote.description ?? ''
    const start = editor?.selectionStart ?? current.length
    const end = editor?.selectionEnd ?? start
    const selected = current.slice(start, end) || placeholder
    const replacement = `${before}${selected}${after}`
    const next = `${current.slice(0, start)}${replacement}${current.slice(end)}`
    updateNode(selectedNote.id, { markdownContent: next })
    window.requestAnimationFrame(() => {
      editorRef.current?.focus()
      editorRef.current?.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  const addLink = () => {
    if (!selectedNote || !linkDraft) return
    addEdge(selectedNote.id, linkDraft, 'related_to', 'Связано с заметкой')
    setLinkDraft('')
  }

  const copyCode = async (key: string, code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else {
        const temporary = document.createElement('textarea')
        temporary.value = code
        temporary.setAttribute('readonly', '')
        temporary.style.position = 'fixed'
        temporary.style.opacity = '0'
        document.body.appendChild(temporary)
        temporary.select()
        const success = typeof document.execCommand === 'function' && document.execCommand('copy')
        temporary.remove()
        if (!success) throw new Error('Буфер обмена недоступен')
      }
      setCopiedBlock(key)
      window.setTimeout(() => setCopiedBlock((current) => current === key ? null : current), 1500)
    } catch {
      setCopiedBlock(null)
    }
  }

  return (
    <div className="content-page notes-editor-page">
      <header className="notes-editor-header">
        <div>
          <span className="eyebrow">ЗАПИСЫВАЙТЕ, ОФОРМЛЯЙТЕ, СВЯЗЫВАЙТЕ</span>
          <h1>Заметки</h1>
          <p>Пишите в Markdown, просматривайте безопасный предпросмотр и связывайте заметки с объектами рабочего пространства.</p>
        </div>
        <div className="notes-editor-header__actions">
          <span className={`notes-save-state notes-save-state--${saveStatus}`} role={saveStatus === 'error' ? 'alert' : 'status'} aria-live={saveStatus === 'error' ? 'assertive' : 'polite'} aria-busy={saveStatus === 'saving'}><i aria-hidden="true" />{saveStatus === 'saved' ? 'Сохранено на устройстве' : saveStatus === 'saving' ? 'Сохранение…' : saveStatus === 'error' ? 'Ошибка сохранения' : 'Сохранение изменений'}</span>
          <button className="button-primary" onClick={createNote}><Plus size={15} /> Новая заметка</button>
        </div>
      </header>

      <div className="notes-editor-search-row">
        <label className="notes-editor-search"><Search size={14} /><input aria-label="Поиск по заметкам" type="search" placeholder="Поиск по названиям, тексту и тегам заметок" value={query} onChange={(event) => onQueryChange?.(event.target.value)} />{query && <button aria-label="Очистить поиск по заметкам" onClick={() => onQueryChange?.('')}><X size={12} /></button>}</label>
        <span>{formatRussianCount(notes.length, { one: 'заметка', few: 'заметки', many: 'заметок' })}</span>
      </div>

      <div className={`notes-editor-workspace${selectedNote ? ' has-active-note' : ''}`}>
        <aside className="notes-list-panel" aria-label="Список заметок">
          {notes.length > 0 ? notes.map((note) => (
            <button key={note.id} className={`notes-list-item${selectedNote?.id === note.id ? ' is-active' : ''}`} onClick={() => { setSelectedNoteId(note.id); setMode('write') }} aria-current={selectedNote?.id === note.id ? 'true' : undefined}>
              <span className="notes-list-item__icon"><StickyNote size={14} /></span>
              <span className="notes-list-item__copy"><strong>{note.title}</strong><span>{plainExcerpt(note.markdownContent ?? note.description)}</span><small>Изменено {formatShortDate(note.updatedAt)}{note.tags.length ? ` · ${note.tags.slice(0, 2).map((tag) => `#${tag}`).join(' ')}` : ''}</small></span>
              <ChevronRight size={13} />
            </button>
          )) : (
            <div className="notes-list-empty"><BookOpen size={19} /><strong>{query ? 'Заметки не найдены' : 'Ваши заметки начинаются здесь'}</strong><span>{query ? 'Измените поисковый запрос.' : 'Создайте заметку, чтобы начать писать.'}</span>{!query && <button className="button-secondary" onClick={createNote}><Plus size={13} /> Создать заметку</button>}</div>
          )}
        </aside>

        {selectedNote ? (
          <article className="note-document" aria-label={`Редактор заметки «${selectedNote.title}»`}>
            <div className="note-document__header">
              <div className="note-document__meta"><span className="knowledge-kind knowledge-kind--note">Заметка</span><span>Создано {formatShortDate(selectedNote.createdAt)}</span><span>Изменено {formatShortDate(selectedNote.updatedAt)}</span></div>
              <div className="note-document__actions">
                <div className="note-mode-toggle" role="group" aria-label="Режим редактора заметки">
                  <button aria-pressed={mode === 'write'} onClick={() => setMode('write')}><StickyNote size={13} /> Редактировать</button>
                  <button aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}><BookOpen size={13} /> Предпросмотр</button>
                </div>
                <button className="icon-button" aria-label={`Открыть заметку «${selectedNote.title}» на холсте`} title="Открыть на холсте" onClick={() => onOpenNode(selectedNote.id)}><Link2 size={14} /></button>
              </div>
            </div>

            <div className="note-document__body">
              <label className="note-title-label" htmlFor="note-document-title">НАЗВАНИЕ ЗАМЕТКИ</label>
              <input id="note-document-title" className="note-title-input" value={titleDraft} maxLength={180} onChange={(event) => updateTitle(event.target.value)} onBlur={commitTitle} />

              {mode === 'write' ? (
                <>
                  <div className="note-markdown-toolbar" role="toolbar" aria-label="Форматирование Markdown">
                    <button title="Заголовок" aria-label="Вставить заголовок" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMarkdown('## ', '', 'Заголовок')}><Heading2 size={15} /></button>
                    <button title="Полужирный" aria-label="Вставить полужирный текст" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMarkdown('**', '**', 'жирный текст')}><Bold size={14} /></button>
                    <button title="Курсив" aria-label="Вставить курсивный текст" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMarkdown('*', '*', 'курсивный текст')}><Italic size={14} /></button>
                    <button title="Маркированный список" aria-label="Вставить элемент списка" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMarkdown('- ', '', 'Элемент списка')}><ListIcon size={14} /></button>
                    <button title="Список задач" aria-label="Вставить задачу в список" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMarkdown('- [ ] ', '', 'Задача')}><CheckSquare size={14} /></button>
                    <button title="Нумерованный список" aria-label="Вставить элемент нумерованного списка" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMarkdown('1. ', '', 'Элемент списка')}><ListOrdered size={14} /></button>
                    <button title="Ссылка" aria-label="Вставить ссылку" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMarkdown('[', '](https://example.com)', 'текст ссылки')}><Link2 size={14} /></button>
                    <button title="Блок кода" aria-label="Вставить блок кода" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMarkdown('```text\n', '\n```', 'Вставьте код сюда')}><Code2 size={14} /></button>
                    <span>Поддерживается формат Markdown</span>
                  </div>
                  <textarea
                    ref={editorRef}
                    className="note-markdown-input"
                    aria-label="Текст заметки в формате Markdown"
                    placeholder={'Напишите заметку…\n\nИспользуйте # для заголовков, - для списков, - [ ] для задач, [ссылки](https://…) и блоки кода в тройных обратных кавычках.'}
                    value={markdown}
                    maxLength={100000}
                    onChange={(event) => updateNode(selectedNote.id, { markdownContent: event.target.value })}
                    spellCheck
                  />
                </>
              ) : (
                <div className="note-markdown-preview" aria-label="Предпросмотр Markdown">
                  {markdown.trim() ? <MarkdownPreview source={markdown} onCopy={copyCode} copiedBlock={copiedBlock} /> : <div className="note-preview-empty"><BookOpen size={18} /><span>Пока нечего показывать. Начните писать в Markdown.</span></div>}
                </div>
              )}

              <section className="note-connections" aria-label="Связанные объекты">
                <div className="note-connections__heading"><div><Network size={14} /><h2>Связанные объекты</h2><span>{links.length}</span></div><span>Только явные связи</span></div>
                {links.length > 0 ? <div className="note-linked-items">{links.map(({ edge, node }) => <div className="note-linked-item" key={edge.id}><button className="note-linked-item__open" onClick={() => onOpenNode(node.id)}><span><strong>{node.title}</strong><small>{kindLabels[node.type]} · {getRelationCaption(edge)}</small></span><ChevronRight size={13} /></button><button className="icon-button" aria-label={`Удалить связь с объектом «${node.title}»`} title="Удалить связь" onClick={() => deleteEdge(edge.id)}><X size={12} /></button></div>)}</div> : <p className="note-connections__empty">Свяжите заметку с проектом, задачей, идеей или другим объектом.</p>}
                <div className="note-link-form"><select aria-label="Выбрать объект для связи с заметкой" value={linkDraft} onChange={(event) => setLinkDraft(event.target.value)}><option value="">Выберите объект…</option>{linkCandidates.map((node) => <option key={node.id} value={node.id}>{kindLabels[node.type]} · {node.title}</option>)}</select><button className="button-secondary" onClick={addLink} disabled={!linkDraft}><Plus size={13} /> Связать объект</button></div>
              </section>
            </div>
          </article>
        ) : (
          <div className="notes-document-empty"><StickyNote size={21} /><h2>Выберите заметку для редактирования</h2><p>Текст автоматически сохраняется на устройстве по мере ввода.</p><button className="button-primary" onClick={createNote}><Plus size={14} /> Создать заметку</button></div>
        )}
      </div>
    </div>
  )
}

function MarkdownPreview({ source, onCopy, copiedBlock }: { source: string; onCopy: (key: string, code: string) => void; copiedBlock: string | null }) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let index = 0
  let codeIndex = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (!line.trim()) { index += 1; continue }

    const fence = line.match(/^\s*```([^\s`]*)\s*$/)
    if (fence) {
      const language = fence[1] || 'text'
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index] ?? '')) {
        codeLines.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      const key = `code-${codeIndex++}`
      const code = codeLines.join('\n')
      blocks.push(<div className="note-preview-code" key={key}><div className="note-preview-code__toolbar"><span>{language}</span><button onClick={() => onCopy(key, code)}><Copy size={12} />{copiedBlock === key ? 'Скопировано' : 'Копировать код'}</button></div><pre><code>{code}</code></pre></div>)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = Math.min(heading[1]?.length ?? 1, 6)
      const text = heading[2] ?? ''
      const Component = `h${level}` as ElementType
      blocks.push(<Component key={`heading-${index}`}>{renderInline(text)}</Component>)
      index += 1
      continue
    }

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(<hr key={`rule-${index}`} />)
      index += 1
      continue
    }

    const checklistMatch = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/)
    const bulletMatch = line.match(/^\s*[-*+]\s+(.+)$/)
    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (checklistMatch || bulletMatch || orderedMatch) {
      const listType = checklistMatch ? 'checklist' : orderedMatch ? 'ordered' : 'bullet'
      const items: { text: string; checked: boolean }[] = []
      while (index < lines.length) {
        const current = lines[index] ?? ''
        const check = current.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/)
        const bullet = current.match(/^\s*[-*+]\s+(.+)$/)
        const ordered = current.match(/^\s*\d+[.)]\s+(.+)$/)
        if (listType === 'checklist' && check) items.push({ text: check[2] ?? '', checked: (check[1] ?? '').toLowerCase() === 'x' })
        else if (listType === 'bullet' && bullet && !check) items.push({ text: bullet[1] ?? '', checked: false })
        else if (listType === 'ordered' && ordered) items.push({ text: ordered[1] ?? '', checked: false })
        else break
        index += 1
      }
      if (listType === 'checklist') {
        blocks.push(<ul className="note-preview-checklist" key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}><input type="checkbox" checked={item.checked} readOnly aria-label={item.checked ? 'Выполненный пункт списка' : 'Пункт списка'} /><span>{renderInline(item.text)}</span></li>)}</ul>)
      } else if (listType === 'ordered') {
        blocks.push(<ol key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item.text)}</li>)}</ol>)
      } else {
        blocks.push(<ul key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item.text)}</li>)}</ul>)
      }
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quoteLines.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push(<blockquote key={`quote-${index}`}>{quoteLines.map((quote, quoteIndex) => <span key={quoteIndex}>{renderInline(quote)}{quoteIndex < quoteLines.length - 1 && <br />}</span>)}</blockquote>)
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length) {
      const current = lines[index] ?? ''
      if (!current.trim() || /^\s*```/.test(current) || /^(#{1,6})\s+/.test(current) || /^\s*(---+|\*\*\*+|___+)\s*$/.test(current) || /^\s*[-*+]\s+/.test(current) || /^\s*\d+[.)]\s+/.test(current) || /^>\s?/.test(current)) break
      paragraph.push(current)
      index += 1
    }
    blocks.push(<p key={`paragraph-${index}`}>{paragraph.map((part, partIndex) => <span key={partIndex}>{renderInline(part)}{partIndex < paragraph.length - 1 && <br />}</span>)}</p>)
  }

  return <div className="note-markdown-rendered">{blocks}</div>
}

function renderInline(text: string): ReactNode[] {
  const tokens = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g
  const output: ReactNode[] = []
  let cursor = 0
  let tokenIndex = 0
  for (const match of text.matchAll(tokens)) {
    const value = match[0]
    const start = match.index ?? 0
    if (start > cursor) output.push(text.slice(cursor, start))
    const key = `inline-${tokenIndex++}`
    const link = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    const inlineCode = value.match(/^`([^`]+)`$/)
    const bold = value.match(/^\*\*([^*]+)\*\*$|^__([^_]+)__$/)
    const italic = value.match(/^\*([^*]+)\*$|^_([^_]+)_$/)
    if (link) {
      const href = safeLink(link[2] ?? '')
      output.push(href ? <a key={key} href={href} target="_blank" rel="noreferrer">{link[1]}</a> : <span key={key}>{link[1]}</span>)
    } else if (inlineCode) output.push(<code key={key}>{inlineCode[1]}</code>)
    else if (bold) output.push(<strong key={key}>{bold[1] ?? bold[2]}</strong>)
    else if (italic) output.push(<em key={key}>{italic[1] ?? italic[2]}</em>)
    else output.push(value)
    cursor = start + value.length
  }
  if (cursor < text.length) output.push(text.slice(cursor))
  return output
}

function safeLink(rawHref: string) {
  const value = rawHref.trim()
  try {
    const resolved = new URL(value, window.location.origin)
    if (['http:', 'https:', 'mailto:'].includes(resolved.protocol)) return resolved.href
  } catch {
    return null
  }
  return null
}

function plainExcerpt(markdown: string) {
  const plain = markdown.replace(/```[\s\S]*?```/g, '[code]').replace(/[#>*_`\[\]()]/g, '').replace(/\s+/g, ' ').trim()
  return plain.slice(0, 110) || 'Пустая заметка'
}

function formatShortDate(value: string) {
  return formatRussianDate(value, { month: 'short', day: 'numeric' })
}
