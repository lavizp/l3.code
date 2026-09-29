import type { SkillProvider } from "./types"

const providers: SkillProvider[] = []

/** Make a provider available to the rest of the server. Once, at boot. */
export function registerProvider(provider: SkillProvider): void {
  providers.push(provider)
}

/** Every registered provider, in registration order. */
export function listProviders(): readonly SkillProvider[] {
  return providers
}

export function getProvider(id: string): SkillProvider | undefined {
  return providers.find(p => p.id === id)
}
