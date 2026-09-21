import type { OutgoingMessageType, TurnStatus } from "commons/types"
import { getAgent } from "../agents"
import { config } from "../config"
import {
  appendAssistantBlocks,
  appendUserMessage,
  saveAgentSessionId
} from "../repositories/sessions"
import { findWorkspaceById } from "../repositories/workspaces"
import { TurnBlocks } from "./turn-blocks"

export type Emit = (message: OutgoingMessageType) => void

/**
 * Persist the user's message, echo it back straight away, then stream the
 * agent's reply block by block. Nothing here waits for the turn to finish
 * before the client hears about it.
 *
 * Which agent runs is the session's own, chosen when it was created.
 */
export async function runTurn(params: {
  sessionId: string
  message: string
  emit: Emit
}): Promise<void> {
  const { sessionId, message, emit } = params

  const appended = await appendUserMessage(sessionId, message)
  if (!appended) {
    throw new Error("Session Not found")
  }
  const workspace = await findWorkspaceById(appended.session.workspaceId)
  if (!workspace) {
    throw new Error("Workspace Not found")
  }

  // Echo the user's own message before the agent runs, so it appears the
  // moment they hit send rather than after the whole reply lands.
  emit({
    type: "message-added",
    payload: { id: appended.messageId, sessionId, role: "user", message }
  })
  emit({ type: "turn-started", payload: { sessionId } })

  const agent = getAgent(appended.session.agentId)
  const turn = new TurnBlocks()
  let agentSessionId = appended.session.agentSessionId
  let status: TurnStatus = "done"
  let error: string | undefined

  try {
    const stream = agent.run({
      prompt: message,
      cwd: workspace.path,
      resumeSessionId: agentSessionId,
      allowedTools: config.allowedTools
    })

    for await (const event of stream) {
      switch (event.type) {
        case "text-start":
          turn.openText(event.blockId, event.text)
          emit({
            type: "block-start",
            payload: { sessionId, blockId: event.blockId, text: event.text }
          })
          break

        case "text-delta":
          turn.appendText(event.blockId, event.text)
          emit({
            type: "block-delta",
            payload: { sessionId, blockId: event.blockId, text: event.text }
          })
          break

        case "tool-start":
          turn.openTool(event.blockId, event.toolUseId, event.name, event.input)
          emit({
            type: "tool-start",
            payload: {
              sessionId,
              blockId: event.blockId,
              toolUseId: event.toolUseId,
              name: event.name,
              input: event.input
            }
          })
          break

        case "tool-end":
          turn.closeTool(event.toolUseId, event.result, event.isError)
          emit({
            type: "tool-end",
            payload: {
              sessionId,
              toolUseId: event.toolUseId,
              result: event.result,
              isError: event.isError
            }
          })
          break

        case "session":
          // Only the first one matters: that's the thread we resume into.
          if (!agentSessionId) {
            agentSessionId = event.sessionId
            await saveAgentSessionId(sessionId, agent.id, event.sessionId)
          }
          break

        case "failed":
          status = "error"
          error = event.message
          break
      }
    }
  } catch (e) {
    status = "error"
    error = e instanceof Error ? e.message : String(e)
    console.error("Agent turn failed:", e)
  }

  for (const tool of turn.abandonRunningTools()) {
    emit({
      type: "tool-end",
      payload: {
        sessionId,
        toolUseId: tool.toolUseId,
        result: tool.result!,
        isError: true
      }
    })
  }

  const persistedId = turn.isEmpty
    ? null
    : await appendAssistantBlocks(sessionId, turn.blocks)

  emit({ type: "turn-ended", payload: { sessionId, id: persistedId, status, error } })
}
