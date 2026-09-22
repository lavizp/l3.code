# l3.code

A self-hosted web UI for coding agents. Point it at a folder on your machine,
start a session, and chat with [Claude Code](https://claude.com/claude-code) or
[Codex](https://developers.openai.com/codex) — the reply streams back token by
token, with every tool call and its result visible inline.

The agent itself is a swappable part. A session picks its agent when it's
created and keeps it for life; everything above the `AgentProvider` seam —
persistence, the websocket protocol, the UI — is written against one
provider-neutral event type, so adding Gemini or a local model is one new file.

## How it fits together

```
browser                          apps/backend                     your machine
┌──────────────┐   websocket    ┌────────────────┐   AgentEvent   ┌──────────┐
│  React UI    │ ─────────────► │ router         │ ◄───────────── │ agent    │
│  transcript  │                │ turn-runner    │                │ provider │
│              │ ◄───────────── │ agents/*       │                │ (SDK)    │
└──────────────┘  block-delta   └────────────────┘                └──────────┘
                  tool-start            │                              │
                  tool-end              ▼                              ▼
                                    MongoDB                     workspace folder
```

One turn: the client sends `add-message`; the backend persists it, echoes it
back immediately, then runs the session's agent in the workspace directory and
forwards its stream as `block-start` / `block-delta` / `tool-start` /
`tool-end`, closing with `turn-ended`. Nothing waits for the turn to finish
before the client hears about it. On the way out, the turn is folded into a
list of blocks and saved, so reloading replays the same transcript.

## Quick start

Prerequisites:

- [Bun](https://bun.com) 1.4+ and Node 24+
- A MongoDB instance (local or Atlas)
- Whichever agent you plan to run, authenticated on this machine — `claude`
  logged in for Claude Code, `codex login` (or `CODEX_API_KEY`) for Codex.
  Both adapters pick up ambient credentials; there's nothing to configure here.

```bash
bun install
```

Create `apps/backend/.env`:

```
DB_URL=mongodb://localhost:27017/l3code
```

Then run both apps:

```bash
bun dev
```

That's `turbo run dev` — backend on `:8080`, frontend on Bun's dev server with
HMR. Open the frontend, choose a folder, start a session, and send a message.

The folder picker browses the *backend's* filesystem, not yours: a browser
never discloses an absolute path, and an absolute path is what the agent needs
for its working directory. Run the two on the same machine.

To run one side only:

```bash
bun dev --filter=backend
```

## Configuration

Backend `.env`, loaded by Bun (no dotenv):

| Variable | Default       | Meaning                                |
| -------- | ------------- | -------------------------------------- |
| `DB_URL` | — (required)  | MongoDB connection string              |
| `PORT`   | `8080`        | Websocket port                         |
| `AGENT`  | `claude-code` | Default provider when a session omits one |

Two constants live in [config.ts](apps/backend/config.ts) rather than the
environment: `allowedTools`, currently `Read`, `Edit`, `Glob` — widen it if you
want the agent to run commands — and the frontend's server URL, in
[src/config.ts](apps/frontend/src/config.ts).

## Layout

```
apps/
  backend/     websocket server; runs an agent in a workspace and streams the turn
  frontend/    React chat UI — sidebar, transcript, composer

packages/
  commons/     the wire protocol: incoming/outgoing message types, zod schemas
  db/          mongoose schemas (Workspace, Session, Message)
  ui/          shared React primitives
  eslint-config/, typescript-config/
```

Each app has its own README with a file-by-file map:
[backend](apps/backend/README.md), [frontend](apps/frontend/README.md).

## Adding an agent

Nothing outside `apps/backend/agents/` knows which agent is running. Write an
adapter that translates the agent's stream into `AgentEvent`s:

```ts
// agents/gemini.ts
import type { AgentEvent, AgentProvider, AgentRunOptions } from "./types"

export const gemini: AgentProvider = {
  id: "gemini",
  label: "Gemini",
  async *run(options: AgentRunOptions): AsyncGenerator<AgentEvent> {
    yield { type: "text-start", blockId: "0", text: "" }
    yield { type: "text-delta", blockId: "0", text: "hello" }
  }
}
```

Register it in [agents/index.ts](apps/backend/agents/index.ts) and it shows up
in the UI's agent picker. The events a provider may emit are `text-start`,
`text-delta`, `tool-start`, `tool-end`, `session` (its own conversation id,
stored so the next turn resumes the same thread) and `failed`. Block ids only
need to be unique within a turn. See
[claude-code.ts](apps/backend/agents/claude-code.ts) for a token-delta stream
and [codex.ts](apps/backend/agents/codex.ts) for one that revises whole items
in place.

## Run it on localhost only

Two things make this a local-only tool as it stands:

- **The websocket server has no authentication.** Anyone who can reach the port
  can browse the filesystem through the folder picker, register any absolute
  path as a workspace, and run an agent in it.
- **The Claude Code adapter uses `permissionMode: "bypassPermissions"`** — tool
  calls are not prompted for. The `allowedTools` list is the only bound;
  Codex relies on its own sandbox instead.

Don't expose the backend port to a network you don't trust.

## Scripts

```bash
bun dev           # turbo run dev — all apps, watch mode
bun run build     # turbo run build
bun run lint
bun run check-types
bun run format    # prettier over **/*.{ts,tsx,md}
```
