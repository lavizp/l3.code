import type { AssistantBlock, Failure, Notice } from "commons/types"

export type UIMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string
      role: "assistant"
      blocks: AssistantBlock[]
      running: boolean
      /** Why the turn stopped, when it didn't finish. */
      error?: Failure
      /**
       * Something the server said mid-turn — a retry, an allowance running
       * low. Only ever set while `running`, and never persisted: it stops
       * being true the moment the turn ends.
       */
      notice?: Notice
    }

export type UIAssistantMessage = Extract<UIMessage, { role: "assistant" }>

export type UISession = {
  id: string
  /** The agent running this session, fixed when it was created. */
  agentId: string
  messages: UIMessage[]
}

/** `id` is null while a workspace we just created is awaiting its server id. */
export type UIWorkspace = {
  id: string | null
  name: string
  path: string
  sessions: UISession[]
}
