# backend

Websocket server that runs a coding agent inside a workspace folder and
streams the turn back to the client.

```bash
bun install
bun dev        # bun --watch index.ts
```

Configuration (`.env`, loaded by Bun):

| Variable | Default        | Meaning                                  |
| -------- | -------------- | ---------------------------------------- |
| `DB_URL` | — (required)   | MongoDB connection string                |
| `PORT`   | `8080`         | Websocket port                           |
| `AGENT`  | `claude-code`  | Which registered agent provider to run   |

## Layout

```
index.ts          bootstrap: connect Mongo, start the websocket server
config.ts         environment + constants, read once

agents/           the agent seam — see below
  types.ts        AgentProvider, AgentRunOptions, AgentEvent
  registry.ts     register / look up providers by id
  claude-code.ts  Claude Code adapter (the only file that knows the SDK)
  index.ts        registers the built-in providers

transport/        websocket plumbing
  connection.ts   one client; the only thing that writes to a socket
  router.ts       incoming message type -> handler
  server.ts       accept sockets, send initial state

services/
  turn-runner.ts  persist, emit, stream one turn
  turn-blocks.ts  assembles the turn's blocks as events arrive

repositories/     all Mongo access
  workspaces.ts
  sessions.ts
```

## Adding an agent

Nothing outside `agents/` knows which agent is running. To add one — Codex,
Gemini, a local model — write an adapter and register it:

```ts
// agents/codex.ts
import type { AgentEvent, AgentProvider, AgentRunOptions } from "./types"

export const codex: AgentProvider = {
  id: "codex",
  async *run(options: AgentRunOptions): AsyncGenerator<AgentEvent> {
    // translate that agent's stream into AgentEvents
    yield { type: "text-start", blockId: "0", text: "" }
    yield { type: "text-delta", blockId: "0", text: "hello" }
  }
}
```

```ts
// agents/index.ts
registerAgent(codex)
```

Then run it with `AGENT=codex`. The events a provider may emit are
`text-start`, `text-delta`, `tool-start`, `tool-end`, `session` (its own
conversation id, stored so the next turn can resume) and `failed`. Block ids
only have to be unique within a turn.
