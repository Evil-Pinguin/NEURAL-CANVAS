import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { createInitialWorkspace } from '../domain/seed'
import { database, DATABASE_VERSION } from './database'

describe('IndexedDB schema migrations', () => {
  it('upgrades a version 1 record and supplies current settings without dropping its data', async () => {
    const legacyDatabase = new Dexie('neural-canvas')
    legacyDatabase.version(1).stores({ workspaces: 'id, updatedAt' })
    await legacyDatabase.open()

    const original = createInitialWorkspace()
    original.nodes.find((node) => node.id === 'systems-thinking')!.favorite = true
    const oldRecord: Record<string, unknown> = JSON.parse(JSON.stringify(original))
    delete oldRecord.settings
    await legacyDatabase.table('workspaces').put(oldRecord)
    legacyDatabase.close()

    await database.open()
    const migrated = await database.workspaces.get(original.id)
    expect(database.verno).toBe(DATABASE_VERSION)
    expect(migrated?.settings).toEqual({ defaultView: 'canvas' })
    expect(migrated?.nodes.find((node) => node.id === 'systems-thinking')?.favorite).toBe(true)
    expect(migrated?.edges).toHaveLength(original.edges.length)
  })
})
