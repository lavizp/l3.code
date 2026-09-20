import z from "zod"

export const WorkspaceCreatedSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string()
})
export type WorkspaceCreatedSchemaype = z.infer<typeof WorkspaceCreatedSchema>

export const SessionCreated = z.object({
  id: z.string(),
  workspaceId: z.string()
})
export type SessionCreatedType = z.infer<typeof SessionCreated>

export const MessageAdded = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.literal("user"),
  message: z.string()
})
export type MessageAddedType = z.infer<typeof MessageAdded>


export type OutgoingMessageType =
  | {
      type: 'workspace-created'
      payload: WorkspaceCreatedSchemaype
    }
  | {
      type: 'session-created'
      payload: SessionCreatedType
    }
  | {
      type: 'message-added'
      payload: MessageAddedType
    }
  | {
      type: 'init'
      workspaces: Workspace[]
    }

export type Workspace = {
  id: string,
  name: string,
  path: string,
  sessions: Session[]
}

export type Session = {
  id: string,
  messages: Message[]
}

export type Message = {
  id: string;
  role: "user",
  payload: {
    message: string
  }
} | {
  id: string;
  role: "assistant",
  payload: any
}
