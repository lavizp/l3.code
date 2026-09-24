import mongoose from "mongoose"
// Registers the built-in agent providers. Must run before any turn does.
import "./agents"
import { config } from "./config"
import { startServer } from "./transport/server"

/**
 * The server is started before the database is up, not after.
 *
 * Waiting for Mongo first means that if it isn't running, the port never
 * opens — and a websocket client can't tell a server with no database from
 * no server at all, so the UI sits in its reconnect loop saying
 * "disconnected" forever. Opening the port first lets it connect, hear
 * exactly what's wrong, and pick the work back up when the database arrives.
 */
startServer(config.port)
console.log(`started on :${config.port}`)

// The driver emits "disconnected" after every failed attempt, including the
// ones before it has ever been up. Only the ones that follow a real
// connection are news; the rest are already covered by the retry log.
let wasConnected = false

mongoose.connection.on("connected", () => {
  wasConnected = true
  console.log("database connected")
})
mongoose.connection.on("disconnected", () => {
  if (wasConnected) {
    wasConnected = false
    console.error("database disconnected — the driver will keep retrying")
  }
})
mongoose.connection.on("error", cause => {
  console.error("database error:", cause instanceof Error ? cause.message : cause)
})

void connect()

/**
 * Keep trying until it works. The driver reconnects on its own once it has
 * connected at least once; this covers the case where it never did — a
 * database that starts after the server does.
 */
async function connect(): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await mongoose.connect(config.dbUrl, {
        serverSelectionTimeoutMS: config.dbTimeoutMs
      })
      return
    } catch (cause) {
      const wait = Math.min(1000 * 2 ** attempt, 30_000)
      console.error(
        `couldn't reach the database (${cause instanceof Error ? cause.message : cause}); retrying in ${wait / 1000}s`
      )
      await new Promise(resolve => setTimeout(resolve, wait))
    }
  }
}
