import { claudeCode } from "./claude-code"
import { registerAgent } from "./registry"

// Built-in providers. Adding another agent means writing its adapter against
// `AgentProvider` and registering it here — nothing downstream changes.
registerAgent(claudeCode)

export { getAgent, listAgents, registerAgent } from "./registry"
export type { AgentEvent, AgentProvider, AgentRunOptions } from "./types"
