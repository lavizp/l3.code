import { CreateWorkspaceSchema, CreateSessionSchema, AddMessageSchema, type IncommingMessageType, type OutgoingMessageType } from "commons/types"
import { WorkspaceModel, SessionModel} from "db/client"
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
      const { success, data } = CreateWorkspaceSchema.safeParse(msg)
      if (!success) {
        throw new Error("Incorrect Schema")
      }
      const workspace = await WorkspaceModel.create({
        path: data.path,
        name: data.path.split("").pop()
      })
      return {
        id: workspace._id
      }
    }
    if (msg.type === 'create-session') {
      const { success, data } = CreateSessionSchema.safeParse(msg)
      if (!success) {
        throw new Error("Incorrect Schema")
      }
      const session = await SessionModel.create({
        workspace: {
          ref: data.workspaceId
        },
        conversation: []
      })
      return {
        id: session._id
      }
    }
    if (msg.type === 'add-message') {
      const { success, data } = AddMessageSchema.safeParse(msg)
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
        id: 1
      }
    }
    throw new Error("Incomming Message Flawed")
  }
}
