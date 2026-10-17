import { describe, expect, it, vi } from 'vitest'
import { AIProviderRegistry, aiCapabilities, type AIProvider } from './AIProvider'

describe('optional AI provider contract', () => {
  it('lists each planned capability without registering or fabricating a provider', () => {
    expect(aiCapabilities).toEqual([
      'idea-generation',
      'node-expansion',
      'project-to-task-breakdown',
      'connection-suggestions',
      'knowledge-summary',
      'study-plan',
      'question-generation',
      'contradiction-analysis',
      'tag-suggestions',
      'node-creation-from-text',
      'structured-import',
    ])
    expect(new AIProviderRegistry().getProvider()).toBeNull()
  })

  it('notifies subscribers when a host replaces or removes the provider', () => {
    const registry = new AIProviderRegistry()
    const provider = {
      id: 'test',
      displayName: 'Test provider',
      capabilities: [],
    } as unknown as AIProvider
    const listener = vi.fn()
    const unsubscribe = registry.subscribe(listener)

    registry.replaceProvider(provider)
    expect(registry.getProvider()).toBe(provider)
    expect(listener).toHaveBeenCalledTimes(1)

    const replacement = {
      id: 'replacement',
      displayName: 'Replacement',
      capabilities: [],
    } as unknown as AIProvider
    registry.replaceProvider(replacement)
    expect(registry.getProvider()).toBe(replacement)
    expect(listener).toHaveBeenCalledTimes(2)

    registry.replaceProvider(null)
    expect(registry.getProvider()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(3)

    unsubscribe()
    registry.replaceProvider(provider)
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
