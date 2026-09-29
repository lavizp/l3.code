import { failure, type IncommingMessageType } from "commons/types"
import { WebSocketServer } from "ws"
import { uuid } from "uuidv4"
import { toFailure } from "../errors"
import { databaseDown, databaseReady } from "../repositories/failure"
import { loadWorkspaces } from "../repositories/workspaces"
import { describeProviders } from "../services/skills"
import { Connection } from "./connection"
import { routeMessage } from "./router"

/** Accept websocket clients and hand their messages to the router. */
export function startServer(port: number): WebSocketServer {
  const server = new WebSocketServer({ port })
  const connections = new Set<Connection>()

  server.on("error", cause => {
    console.error("Websocket server error:", cause)
  })

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
        connection.fail(failure("bad-request", "That message wasn't valid JSON."))
        return
      }
      // The router answers its own failures; anything that still escapes is a
      // bug in the router, and the client is owed an answer regardless.
      try {
        await routeMessage(connection, parsed as IncommingMessageType)
      } catch (cause) {
        console.error("Unhandled routing failure:", cause)
        connection.fail(toFailure(cause))
      }
    })

    socket.on("error", cause => {
      // `ws` emits this before `close` for a socket that broke rather than
      // being closed politely. Logged only: the close handler does the work.
      console.error("Client socket error:", cause)
    })

    socket.on("close", () => {
      connections.delete(connection)
      connection.close()
    })

    void sendInitialState(connection)
  })

  return server
}

/** Everything the client needs to draw the app on connect. */
async function sendInitialState(connection: Connection): Promise<void> {
  // Which agents are installed is a question about this machine, not about
  // the database — and the skills that follow a person around can be listed
  // without either. So a UI with no database still draws, and still shows
  // the personal skills; only the project list is missing.
  const providers = await describeProviders()

  if (!databaseReady()) {
    connection.send({ type: "init", workspaces: [], providers })
    connection.fail(databaseDown())
    return
  }

  try {
    connection.send({ type: "init", workspaces: await loadWorkspaces(), providers })
  } catch (cause) {
    console.error("Failed to load projects:", cause)
    connection.send({ type: "init", workspaces: [], providers })
    connection.fail(toFailure(cause))
  }
}
