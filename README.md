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

| Variable                | Default       | Meaning                                              |
| ----------------------- | ------------- | ---------------------------------------------------- |
| `DB_URL`                | — (required)  | MongoDB connection string                            |
| `PORT`                  | `8080`        | Websocket port                                       |
| `AGENT`                 | `claude-code` | Default provider when a session omits one            |
| `AGENT_IDLE_TIMEOUT_MS` | `120000`      | Longest silence from an agent before the turn is cut |
| `DB_TIMEOUT_MS`         | `5000`        | How long to wait for Mongo before calling it down    |

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
stored so the next turn resumes the same thread), `notice` and `failed`. Block
ids only need to be unique within a turn. An adapter is also expected to
honour `options.signal` and to describe its own failures — see
[When it goes wrong](#when-it-goes-wrong). See
[claude-code.ts](apps/backend/agents/claude-code.ts) for a token-delta stream
and [codex.ts](apps/backend/agents/codex.ts) for one that revises whole items
in place.

## When it goes wrong

An agent turn can fail in ways that are nothing alike, and "something went
wrong" is the same unhelpful answer to all of them. So nothing here reports a
failure as a string. Every failure is a `Failure` from
[commons/errors.ts](packages/commons/errors.ts): a `kind` the UI branches on,
one sentence for the person, the provider's own words kept aside as `detail`,
whether sending the same thing again stands a chance, and — for a limit — the
moment it lifts.

What that buys, case by case:

- **The plan's allowance runs out.** The Claude adapter reads the SDK's own
  rate-limit accounting, which is the only thing that tells a spent weekly
  allowance from a burst being throttled: the API reports both as a 429. The
  banner shows the reset time, counts down to it, and the composer comes back
  on by itself when it passes. An allowance getting close arrives first as a
  `notice`, while the turn is still running.
- **The agent stops responding.** A stalled stream doesn't close, it just goes
  quiet, and a `for await` over it waits forever.
  [watchdog.ts](apps/backend/services/watchdog.ts) bounds the silence between
  two events — not the length of the turn, so a long job that keeps emitting
  is never cut off — and aborts the agent when it's exceeded.
- **The connection drops.** Client-side, the live turn is closed with what had
  arrived so far, because only `turn-ended` would otherwise ever close it.
  Server-side, the disconnect aborts the agent rather than leaving it working
  on a reply with nowhere to go.
- **The database is down.** The websocket port opens before Mongo is reached,
  so the UI can connect and be told what's wrong instead of sitting in a
  reconnect loop against a port that never opened. The folder picker still
  works; everything else fails immediately rather than on a 30-second driver
  timeout.
- **The agent isn't signed in, or isn't installed.** Reported as `auth` and
  `agent-unavailable`, which are not offered a retry button — nothing about
  sending the same message again signs anybody in.

A turn always ends with exactly one `turn-ended`, whatever happens in between,
and whatever the agent managed to write before failing is saved.

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
