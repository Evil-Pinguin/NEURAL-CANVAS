import Dexie, { type Table } from 'dexie'
import { workspaceSchema, type Workspace } from '../domain/model'

export const DATABASE_VERSION = 2

class NeuralCanvasDatabase extends Dexie {
  workspaces!: Table<Workspace, string>

  constructor() {
    super('neural-canvas')
    this.version(1).stores({ workspaces: 'id, updatedAt' })
    this.version(DATABASE_VERSION)
      .stores({ workspaces: 'id, updatedAt' })
      .upgrade(async (transaction) => {
        // Normalize records that are valid under the previous schema. Invalid rows are
        // deliberately left untouched for recovery rather than replaced with seed data.
        await transaction.table('workspaces').toCollection().modify((stored: Workspace) => {
          const parsed = workspaceSchema.safeParse(stored)
          if (!parsed.success) return
          const record = stored as unknown as Record<string, unknown>
          Object.keys(record).forEach((key) => { delete record[key] })
          Object.assign(record, parsed.data)
        })
      })
  }
}

export const database = new NeuralCanvasDatabase()

export async function readWorkspace(id: string): Promise<unknown | undefined> {
  return database.workspaces.get(id)
}

export async function readWorkspaces(): Promise<unknown[]> {
  return database.workspaces.toArray()
}

export async function writeWorkspace(workspace: Workspace): Promise<void> {
  await database.workspaces.put(workspaceSchema.parse(workspace))
}

/** Atomically preserve the current record as a backup before replacing its workspace row. */
export async function replaceWorkspaceWithBackup(
  current: Workspace,
  replacement: Workspace,
  backup: Workspace,
): Promise<void> {
  const validatedReplacement = workspaceSchema.parse(replacement)
  const validatedCurrent = workspaceSchema.parse(current)
  const validatedBackup = workspaceSchema.parse(backup)

  await database.transaction('rw', database.workspaces, async () => {
    const storedCurrent = await database.workspaces.get(validatedCurrent.id)
    const latestCurrent = storedCurrent ? workspaceSchema.parse(storedCurrent) : validatedCurrent
    const durableBackup = workspaceSchema.parse({
      ...latestCurrent,
      id: validatedBackup.id,
      name: validatedBackup.name,
      description: validatedBackup.description,
      createdAt: validatedBackup.createdAt,
      updatedAt: validatedBackup.updatedAt,
    })
    await database.workspaces.put(durableBackup)
    await database.workspaces.put(validatedReplacement)
  })
}
