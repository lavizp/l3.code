import { claudeCode } from "./claude-code"
import { codex } from "./codex"
import { registerProvider } from "./registry"

// Built-in providers, in the order the UI lists them. Adding another agent
// means writing its adapter against `SkillProvider` and registering it here —
// nothing downstream changes.
registerProvider(claudeCode)
registerProvider(codex)

export { getProvider, listProviders, registerProvider } from "./registry"
export type { Problem, Scope, Sighting, SkillProvider, WritableScope } from "./types"
