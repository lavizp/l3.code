import { claudeCode } from "./claude-code"
import { codex } from "./codex"
import { registerAgent } from "./registry"

// Built-in providers, in the order the UI offers them. Adding another agent
// means writing its adapter against `AgentProvider` and registering it here —
// nothing downstream changes.
registerAgent(claudeCode)
registerAgent(codex)

export { getAgent, listAgents, registerAgent } from "./registry"
export type { AgentEvent, AgentProvider, AgentRunOptions } from "./types"
