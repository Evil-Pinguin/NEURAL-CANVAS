import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import { workspaceSchema } from '../domain/model'
import { database, DATABASE_VERSION, readWorkspace, readWorkspaces, writeWorkspace } from './database'
import { useWorkspaceStore } from '../store/workspace-store'

describe('IndexedDB workspace persistence', () => {
  beforeEach(async () => {
    await database.open()
    await database.workspaces.clear()
    localStorage.clear()
    const workspace = createInitialWorkspace()
    await writeWorkspace(workspace)
    useWorkspaceStore.setState({
      workspace,
      workspaces: [],
      isReady: false,
      saveStatus: 'loading',
      storageError: null,
      storageWarning: null,
      selectedNodeId: null,
    })
    await useWorkspaceStore.getState().initialize()
  })

  it('uses the migrated database schema version and lists stored workspaces', async () => {
    expect(database.verno).toBe(DATABASE_VERSION)
    expect(DATABASE_VERSION).toBe(2)
    const stored = await readWorkspaces()
    expect(stored).toHaveLength(1)
    expect(workspaceSchema.parse(stored[0]).settings).toEqual({ defaultView: 'canvas' })
  })

  it('round-trips nodes, links, notes, settings, and favorites after reopening the database', async () => {
    const workspace = createInitialWorkspace()
    workspace.settings.defaultView = 'developer'
    workspace.nodes.find((node) => node.id === 'systems-thinking')!.favorite = true
    workspace.nodes.find((node) => node.id === 'systems-thinking')!.frameSize = { width: 520, height: 320 }
    workspace.nodes.find((node) => node.id === 'learning-log')!.markdownContent = '# Local note'
    await writeWorkspace(workspace)

    database.close()
    await database.open()
    const reopened = await readWorkspace(workspace.id)
    expect(workspaceSchema.parse(reopened)).toEqual(workspace)
    expect(database.isOpen()).toBe(true)
  })

  it('never replaces invalid saved data with a starter workspace', async () => {
    await database.workspaces.clear()
    const invalid = { id: 'workspace-main', name: 'Damaged record', nodes: [{ id: 'incomplete' }] }
    await database.workspaces.put(invalid as never)
    useWorkspaceStore.setState({ isReady: false, storageError: null, storageWarning: null, workspaces: [] })

    await useWorkspaceStore.getState().initialize()

    expect(useWorkspaceStore.getState().isReady).toBe(false)
    expect(useWorkspaceStore.getState().storageError).toMatch(/не удалось проверить/)
    expect(await database.workspaces.count()).toBe(1)
    expect(await database.workspaces.get('workspace-main')).toEqual(invalid)
  })

  it('creates an automatic local backup before a confirmed replacement', async () => {
    const current = createInitialWorkspace()
    current.name = 'Keep this workspace'
    current.settings.defaultView = 'notes'
    await writeWorkspace(current)
    useWorkspaceStore.setState({
      workspace: current,
      workspaces: [{ id: current.id, name: current.name, updatedAt: current.updatedAt }],
      isReady: true,
      saveStatus: 'saved',
      storageError: null,
      storageWarning: null,
      selectedNodeId: 'systems-thinking',
    })

    const incoming = createInitialWorkspace()
    incoming.name = 'Imported workspace'
    incoming.nodes[0]!.favorite = false
    const result = await useWorkspaceStore.getState().importWorkspace(incoming, 'replace')

    expect(result).toMatchObject({ success: true, mode: 'replace', backupName: expect.stringContaining('(резервная копия') })
    const stored = (await readWorkspaces()).map((item) => workspaceSchema.parse(item))
    const replacement = stored.find((item) => item.id === current.id)
    const backup = stored.find((item) => item.id.startsWith('workspace-backup-'))
    expect(replacement?.name).toBe('Imported workspace')
    expect(backup).toMatchObject({ name: result.success ? result.backupName : '', settings: { defaultView: 'notes' } })
    expect(backup?.nodes.find((node) => node.id === 'systems-thinking')?.favorite).toBe(false)
    expect(useWorkspaceStore.getState().saveStatus).toBe('saved')
  })
})
