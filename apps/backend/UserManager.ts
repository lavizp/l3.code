import WebSocket from "ws"
import { User } from "./User"
import { uuid } from "uuidv4"
import { SessionModel, WorkspaceModel } from "db/client"
import type {
  Workspace,
  Session,
  Message,
  IncommingMessageType
} from "commons/types"

export class UserManager {
  private users: User[]
  private static instance: UserManager
  private constructor() {
    this.users = []
  }
  static getInstance(): UserManager {
    if (UserManager.instance) {
      return UserManager.instance
    }
    UserManager.instance = new UserManager()
    return UserManager.instance
  }

  async addUser(ws: WebSocket) {
    const id = uuid()
    const user = new User(id, ws)
    this.users.push(user)

    // Wire handlers before the first await so nothing sent by a fast client
    // is dropped while the initial state is still loading.
    ws.on("message", async (msg) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(msg.toString())
      } catch {
        console.error("User sent malformed JSON:", msg.toString())
        user.sendmessage({
          type: 'error',
          payload: { message: "That message wasn't valid JSON." }
        })
        return
      }
      try {
        await user.handleIncommingMessage(parsed as IncommingMessageType)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error("Failed to handle message:", e)
        user.sendmessage({ type: 'error', payload: { message } })
      }
    })

    ws.on("close", () => {
      this.users = this.users.filter(x => x.id != id)
    })

    try {
      user.sendmessage({
        type: "init",
        workspaces: await this.loadWorkspaces()
      })
    } catch (e) {
      console.error("Failed to load workspaces:", e)
      user.sendmessage({
        type: 'error',
        payload: { message: "Couldn't load workspaces from the database." }
      })
    }
  }

  /** Every workspace with its sessions and full conversation history. */
  private async loadWorkspaces(): Promise<Workspace[]> {
    const [workspaces, sessions] = await Promise.all([
      WorkspaceModel.find(),
      SessionModel.find()
    ])

    const sessionsByWorkspace = new Map<string, Session[]>()
    for (const s of sessions) {
      const key = s.workspace?.toString()
      if (!key) {
        continue
      }
      const messages: Message[] = s.conversation.map(m => ({
        id: m._id.toString(),
        role: m.role,
        payload: m.payload
      })) as Message[]

      const list = sessionsByWorkspace.get(key) ?? []
      list.push({ id: s._id.toString(), messages })
      sessionsByWorkspace.set(key, list)
    }

    return workspaces.map(w => ({
      id: w._id.toString(),
      name: w.name!,
      path: w.path!,
      sessions: sessionsByWorkspace.get(w._id.toString()) ?? []
    }))
  }
}
