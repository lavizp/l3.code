# frontend

The chat UI: a websocket client that streams an agent turn into a transcript.
It talks to `apps/backend` over the message types in `packages/commons`.

```bash
bun install
bun dev        # bun --hot src/index.ts
bun start      # production
bun run build  # bundle to dist/
```

The server URL lives in `src/config.ts`.

## Layout

```
src/
  frontend.tsx           React entry point, loaded by index.html
  index.ts               dev/prod server that serves index.html
  App.tsx                layout only — state comes from useAgentClient
  config.ts

  hooks/
    useSocket.ts         one reconnecting socket, with its backoff on show
    useAgentClient.ts    workspaces, the open session, and the actions
    useCountdown.ts      ticks down to a limit's reset so the UI re-enables

  lib/failure.ts         a Failure's title, tone and countdown formatting

  lib/transcript/        the server event -> UI state fold
    types.ts             UIWorkspace / UISession / UIMessage
    ids.ts               live and optimistic-local message ids
    normalize.ts         persisted messages -> renderable ones
    update.ts            immutable helpers, plus endLiveTurns for a dropped socket
    apply-event.ts       applyEvent: one server event -> next state
    selectors.ts         session title, is-running, lookups

  lib/markdown/          streaming-tolerant markdown renderer
    parse.ts             source -> blocks
    inline.tsx           code spans, emphasis, links
    Markdown.tsx         blocks -> React

  components/
    sidebar/             workspace tree, add-workspace form, connection dot
    transcript/          the turn list, user/assistant turns, tool rows
    Composer.tsx         the message box
    ErrorBanner.tsx      what went wrong, and the button that does something
    ui/                  shadcn primitives
```

State lives in one place: `applyEvent` folds every server event into the
workspace tree, and `useAgentClient` owns that tree. Components take props and
render.

## When things go wrong

A failure arrives as a `Failure` from `commons` — a `kind`, a sentence, the
provider's own words, and sometimes a `retryAt`. It is shown twice, on
purpose: `TurnFailure` puts it in the transcript beside the reply it cut
short, where it stays as a record, and `ErrorBanner` puts it at the top with
whatever action it affords — send again, reconnect, or a countdown to a limit
lifting.

Two invariants are worth knowing before changing any of this. A live
assistant turn is closed only by `turn-ended`, so `endLiveTurns` closes them
when the socket drops instead — otherwise the caret blinks forever and the
session's one live id is never freed for the next turn. And a usage limit
with a known reset disables the composer until `useCountdown` reaches zero,
which is what puts it back without a reload.
