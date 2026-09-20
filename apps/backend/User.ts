import { CreateWorkspaceSchema, CreateSessionSchema, AddMessageSchema, type IncommingMessageType, type OutgoingMessageType } from "commons/types"
import { WorkspaceModel, SessionModel} from "db/client"
import mongoose from "mongoose"
import type WebSocket from "ws"

export class User {
  private socket: WebSocket
  public id: string
  constructor(id: string, socket: WebSocket) {
    this.socket = socket
    this.id = id
  }
  async sendmessage(payload: OutgoingMessageType) {
    this.socket.send((JSON.stringify(payload)))
  }
  async handleIncommingMessage(msg: IncommingMessageType): Promise<OutgoingMessageType> {
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
      return {
        type: 'workspace-created',
        payload: {
              id: workspace._id.toString(),
              path: workspace.path!,
              name
          }
      }
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
      return {
        type: 'session-created',
        payload: {
          id: session._id.toString(),
          workspaceId: data.workspaceId
          }
      }
    }
    if (msg.type === 'add-message') {
      const { success, data } = AddMessageSchema.safeParse(msg.payload)
      if (!success) {
        throw new Error("Incorrect Schema")
      }
      const session = await SessionModel.findByIdAndUpdate(
        data.sessionId,
        {
          $push: {
            conversation: {
              role: "user",
              payload: {
                message: data.message
              }
            }
          }
        },
        { new: true }
      )
      if (!session) {
        throw new Error("Session not found")
      }
      const added = session.conversation[session.conversation.length - 1]!
      return {
        type: 'message-added',
        payload: {
          id: added._id.toString(),
          sessionId: data.sessionId,
          role: "user",
          message: data.message
        }
      }
    }
    throw new Error("Incomming Message Flawed")
  }
}
