import type { IncommingMessageType } from "commons/types"
import { WebSocketServer } from "ws"
import { uuid } from "uuidv4"
import { listAgents } from "../agents"
import { loadWorkspaces } from "../repositories/workspaces"
import { Connection } from "./connection"
import { routeMessage } from "./router"

/** Accept websocket clients and hand their messages to the router. */
export function startServer(port: number): WebSocketServer {
  const server = new WebSocketServer({ port })
  const connections = new Set<Connection>()

  server.on("connection", socket => {
    const connection = new Connection(uuid(), socket)
    connections.add(connection)

    // Wire handlers before the first await so nothing sent by a fast client
    // is dropped while the initial state is still loading.
    socket.on("message", async raw => {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        console.error("User sent malformed JSON:", raw.toString())
        connection.send({
          type: "error",
          payload: { message: "That message wasn't valid JSON." }
        })
        return
      }
      try {
        await routeMessage(connection, parsed as IncommingMessageType)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error("Failed to handle message:", e)
        connection.send({ type: "error", payload: { message } })
      }
    })

    socket.on("close", () => {
      connections.delete(connection)
    })

    void sendInitialState(connection)
  })

  return server
}

/** Everything the client needs to draw the app on connect. */
async function sendInitialState(connection: Connection): Promise<void> {
  try {
    connection.send({
      type: "init",
      workspaces: await loadWorkspaces(),
      agents: listAgents()
    })
  } catch (e) {
    console.error("Failed to load workspaces:", e)
    connection.send({
      type: "error",
      payload: { message: "Couldn't load workspaces from the database." }
    })
  }
}
