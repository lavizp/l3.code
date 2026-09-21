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
    useSocket.ts         one reconnecting socket
    useAgentClient.ts    workspaces, the open session, and the three actions

  lib/transcript/        the server event -> UI state fold
    types.ts             UIWorkspace / UISession / UIMessage
    ids.ts               live and optimistic-local message ids
    normalize.ts         persisted messages -> renderable ones
    update.ts            immutable helpers over the workspace tree
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
    ui/                  shadcn primitives
```

State lives in one place: `applyEvent` folds every server event into the
workspace tree, and `useAgentClient` owns that tree. Components take props and
render.
