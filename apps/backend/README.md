# backend

Websocket server that runs a coding agent inside a workspace folder and
streams the turn back to the client.

```bash
bun install
bun dev        # bun --watch index.ts
```

Configuration (`.env`, loaded by Bun):

| Variable                 | Default       | Meaning                                              |
| ------------------------ | ------------- | ---------------------------------------------------- |
| `DB_URL`                 | — (required)  | MongoDB connection string                            |
| `PORT`                   | `8080`        | Websocket port                                       |
| `AGENT`                  | `claude-code` | Which registered agent provider to run               |
| `AGENT_IDLE_TIMEOUT_MS`  | `120000`      | Longest silence from an agent before the turn is cut |
| `DB_TIMEOUT_MS`          | `5000`        | How long to wait for Mongo before calling it down    |

## Layout

```
index.ts          bootstrap: start the server, then keep reaching for Mongo
config.ts         environment + constants, read once
errors.ts         FailureError and toFailure: a throw that knows how it reads

agents/           the agent seam — see below
  types.ts        AgentProvider, AgentRunOptions, AgentEvent
  registry.ts     register / look up providers by id
  claude-code.ts  Claude Code adapter (the only file that knows the SDK)
  codex.ts        Codex adapter
  failures.ts     provider trouble -> a Failure the UI can branch on
  index.ts        registers the built-in providers

transport/        websocket plumbing
  connection.ts   one client; the only thing that writes to a socket
  router.ts       incoming message type -> handler; answers its own failures
  server.ts       accept sockets, send initial state

services/
  turn-runner.ts  persist, emit, stream one turn; always ends it
  turn-blocks.ts  assembles the turn's blocks as events arrive
  watchdog.ts     fails a turn whose agent has gone quiet
  directory.ts    filesystem walking for the folder picker

repositories/     all Mongo access
  workspaces.ts
  sessions.ts
  failure.ts      a bad id vs. a database that isn't there
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
conversation id, stored so the next turn can resume), `notice` (something
mid-turn worth saying that isn't fatal) and `failed`. Block ids only have to
be unique within a turn.

An adapter is also where trouble gets a name. `failed` carries a `Failure`,
not a string: a `kind` the UI branches on, a sentence for the person, the
provider's own words as `detail`, and — for a limit — `retryAt`. Map the
provider's own error codes where it has them and fall back to
`classifyText` where it only offers a sentence; `agents/failures.ts` has both
and the phrasing for every kind.

```ts
import { agentFailure, classifyText } from "./failures"

yield { type: "failed", error: agentFailure(classifyText(message), "Gemini", { detail: message }) }
```

Providers must also honour `options.signal`, which is aborted when the client
disconnects or the turn stalls. An adapter that ignores it leaves the agent
working — and billing — for a reply nobody will read.
