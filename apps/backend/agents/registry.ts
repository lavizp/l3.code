import { config } from "../config"
import type { AgentProvider } from "./types"

const providers = new Map<string, AgentProvider>()

/** Make a provider available to `getAgent`. Called once per provider at boot. */
export function registerAgent(provider: AgentProvider): void {
  providers.set(provider.id, provider)
}

/** Look up a provider by id, falling back to the configured default. */
export function getAgent(id: string = config.defaultAgentId): AgentProvider {
  const provider = providers.get(id)
  if (!provider) {
    throw new Error(
      `Unknown agent provider "${id}". Registered: ${listAgents().join(", ") || "none"}`
    )
  }
  return provider
}

export function listAgents(): string[] {
  return [...providers.keys()]
}
