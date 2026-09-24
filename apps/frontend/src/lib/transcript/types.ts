import type { AssistantBlock } from "commons/types"

export type UIMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string
      role: "assistant"
      blocks: AssistantBlock[]
      running: boolean
      error?: string
    }

export type UIAssistantMessage = Extract<UIMessage, { role: "assistant" }>

export type UISession = {
  id: string
  /** The agent running this session, fixed when it was created. */
  agentId: string
  /** What the person called it, or null to fall back to a derived title. */
  name: string | null
  messages: UIMessage[]
}

/** `id` is null while a workspace we just created is awaiting its server id. */
export type UIWorkspace = {
  id: string | null
  name: string
  path: string
  sessions: UISession[]
}
