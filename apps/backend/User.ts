import {
  CreateWorkspaceSchema,
  CreateSessionSchema,
  AddMessageSchema,
  type IncommingMessageType,
  type OutgoingMessageType,
  type AssistantBlock,
  type TextBlock,
  type ToolBlock,
  type TurnStatus
} from "commons/types"
import { WorkspaceModel, SessionModel } from "db/client"
import mongoose from "mongoose"
import type WebSocket from "ws"
import { query } from "@anthropic-ai/claude-agent-sdk";

/** Tools the agent may use. Everything else is refused by the SDK. */
const ALLOWED_TOOLS = ["Read", "Edit", "Glob"]

/** Flatten a tool_result payload into something renderable. */
function stringifyToolResult(content: unknown): string {
  if (typeof content === "string") {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === "string") return part
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text)
        }
        return JSON.stringify(part)
      })
      .join("\n")
  }
  if (content == null) {
    return ""
  }
  return JSON.stringify(content)
}

export class User {
  private socket: WebSocket
  public id: string
  constructor(id: string, socket: WebSocket) {
    this.socket = socket
    this.id = id
  }

  sendmessage(payload: OutgoingMessageType) {
    if (this.socket.readyState !== this.socket.OPEN) {
      return
    }
    this.socket.send(JSON.stringify(payload))
  }

  async handleIncommingMessage(msg: IncommingMessageType): Promise<void> {
    if (msg.type === 'create-workspace') {
      const { success, data } = CreateWorkspaceSchema.safeParse(msg.payload)
      if (!success) {
        throw new Error("Incorrect Schema")
      }
      const name: string = data.path.split("/").filter(Boolean).pop() ?? data.path
      const workspace = await WorkspaceModel.create({
        path: data.path,
        name: name
      })
      this.sendmessage({
        type: 'workspace-created',
        payload: {
          id: workspace._id.toString(),
          path: workspace.path!,
          name
        }
      })
      return
    }

    if (msg.type === 'create-session') {
      const { success, data } = CreateSessionSchema.safeParse(msg.payload)
      if (!success) {
        throw new Error("Incorrect Schema")
      }
      const session = await SessionModel.create({
        workspace: new mongoose.Types.ObjectId(data.workspaceId),
        conversation: []
      })
      this.sendmessage({
        type: 'session-created',
        payload: {
          id: session._id.toString(),
          workspaceId: data.workspaceId
        }
      })
      return
    }

    if (msg.type === 'add-message') {
      const { success, data } = AddMessageSchema.safeParse(msg.payload)
      if (!success) {
        throw new Error("Incorrect Schema")
      }
      await this.runTurn(data.sessionId, data.message)
      return
    }

    throw new Error("Incomming Message Flawed")
  }

  /**
   * Persist the user's message, echo it back straight away, then stream the
   * agent's reply block by block. Nothing here waits for the turn to finish
   * before the client hears about it.
   */
  private async runTurn(sessionId: string, message: string): Promise<void> {
    const session = await SessionModel.findByIdAndUpdate(
      sessionId,
      {
        $push: {
          conversation: {
            role: "user",
            payload: { message }
          }
        }
      },
      { new: true }
    )
    if (!session) {
      throw new Error("Session Not found")
    }
    const workspace = await WorkspaceModel.findOne({ _id: session.workspace })
    if (!workspace) {
      throw new Error("Workspace Not found")
    }

    // Echo the user's own message before the agent runs, so it appears the
    // moment they hit send rather than after the whole reply lands.
    const stored = session.conversation[session.conversation.length - 1]!
    this.sendmessage({
      type: 'message-added',
      payload: {
        id: stored._id.toString(),
        sessionId,
        role: "user",
        message
      }
    })
    this.sendmessage({ type: 'turn-started', payload: { sessionId } })

    const blocks: AssistantBlock[] = []
    const toolsById = new Map<string, ToolBlock>()
    let status: TurnStatus = "done"
    let error: string | undefined

    try {
      const stream = query({
        prompt: message,
        options: {
          cwd: workspace.path!,
          allowedTools: ALLOWED_TOOLS,
          resume: session.anthropicSessionId ?? undefined,
          permissionMode: "bypassPermissions",
          // Emit Messages API stream events so text arrives token by token
          // instead of only as a finished block.
          includePartialMessages: true
        }
      })

      // Stream events number their blocks per message, so pair a message
      // counter with the block index for an id unique across the turn.
      let messageSeq = 0
      let sawTextDelta = false
      const openText = new Map<string, TextBlock>()

      for await (const event of stream) {
        // Keep the transcript to the main agent; subagent frames carry a
        // parent tool id and would interleave confusingly.
        if ("parent_tool_use_id" in event && event.parent_tool_use_id) {
          continue
        }

        if (event.type === "stream_event") {
          const raw = event.event

          if (raw.type === "message_start") {
            messageSeq++
            continue
          }

          if (raw.type === "content_block_start" && raw.content_block.type === "text") {
            const blockId = `${messageSeq}:${raw.index}`
            const block: TextBlock = {
              kind: "text",
              id: blockId,
              text: raw.content_block.text ?? ""
            }
            openText.set(blockId, block)
            blocks.push(block)
            this.sendmessage({
              type: 'block-start',
              payload: { sessionId, blockId, text: block.text }
            })
            continue
          }

          if (raw.type === "content_block_delta" && raw.delta.type === "text_delta") {
            const blockId = `${messageSeq}:${raw.index}`
            const block = openText.get(blockId)
            if (block) {
              block.text += raw.delta.text
            }
            sawTextDelta = true
            this.sendmessage({
              type: 'block-delta',
              payload: { sessionId, blockId, text: raw.delta.text }
            })
          }
          continue
        }

        if (event.type === "assistant") {
          // Tool calls come from the completed message so the input is whole
          // JSON rather than reassembled partial deltas.
          for (const block of event.message.content) {
            if (block.type === "tool_use") {
              const toolBlock: ToolBlock = {
                kind: "tool",
                id: `tool:${block.id}`,
                toolUseId: block.id,
                name: block.name,
                input: block.input,
                status: "running"
              }
              toolsById.set(block.id, toolBlock)
              blocks.push(toolBlock)
              this.sendmessage({
                type: 'tool-start',
                payload: {
                  sessionId,
                  blockId: toolBlock.id,
                  toolUseId: block.id,
                  name: block.name,
                  input: block.input
                }
              })
            } else if (block.type === "text" && !sawTextDelta) {
              // Fallback for a run that produced no deltas, so text is never
              // silently dropped.
              const blockId = `whole:${blocks.length}`
              blocks.push({ kind: "text", id: blockId, text: block.text })
              this.sendmessage({
                type: 'block-start',
                payload: { sessionId, blockId, text: block.text }
              })
            }
          }
          continue
        }

        if (event.type === "user") {
          const content = event.message.content
          if (!Array.isArray(content)) {
            continue
          }
          for (const block of content) {
            if (block.type !== "tool_result") {
              continue
            }
            const result = stringifyToolResult(block.content)
            const isError = block.is_error === true
            const toolBlock = toolsById.get(block.tool_use_id)
            if (toolBlock) {
              toolBlock.result = result
              toolBlock.status = isError ? "error" : "done"
            }
            this.sendmessage({
              type: 'tool-end',
              payload: { sessionId, toolUseId: block.tool_use_id, result, isError }
            })
          }
          continue
        }

        if (event.type === "result") {
          if (!session.anthropicSessionId && event.session_id) {
            session.anthropicSessionId = event.session_id
            await session.save()
          }
          if (event.subtype !== "success") {
            status = "error"
            error = event.errors?.join("\n") || event.subtype
          }
        }
      }
    } catch (e) {
      status = "error"
      error = e instanceof Error ? e.message : String(e)
      console.error("Agent turn failed:", e)
    }

    // Any tool still running never reported back — don't leave it spinning
    // in the UI forever.
    for (const tool of toolsById.values()) {
      if (tool.status === "running") {
        tool.status = "error"
        tool.result = tool.result ?? "No result returned."
        this.sendmessage({
          type: 'tool-end',
          payload: {
            sessionId,
            toolUseId: tool.toolUseId,
            result: tool.result,
            isError: true
          }
        })
      }
    }

    let persistedId: string | null = null
    if (blocks.length > 0) {
      const updated = await SessionModel.findByIdAndUpdate(
        sessionId,
        {
          $push: {
            conversation: {
              role: "assistant",
              payload: { type: "blocks", blocks }
            }
          }
        },
        { new: true }
      )
      const saved = updated?.conversation[updated.conversation.length - 1]
      persistedId = saved?._id.toString() ?? null
    }

    this.sendmessage({
      type: 'turn-ended',
      payload: { sessionId, id: persistedId, status, error }
    })
  }
}
