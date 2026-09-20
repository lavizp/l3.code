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
      const name: string = data.path.split("").pop()!
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
          id: session._id.toString()
          }
      }
    }
    if (msg.type === 'add-message') {
      const { success, data } = AddMessageSchema.safeParse(msg.payload)
      if (!success) {
        throw new Error("Incorrect Schema")
      }
      await SessionModel.updateOne({
        id: data.sessionId
      }, {
        conversation: {
          $push: {
            type: "user",
            payload: {
              message: data.message
            }
          }
        }
      })
      return {
        type: 'message-added',
        payload: {
          id:"1"
        }
      }
    }
    throw new Error("Incomming Message Flawed")
  }
}
