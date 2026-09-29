# frontend

The skill pane: a websocket client that lists every `SKILL.md` the agents on
this machine can see, and edits the ones this app owns. It talks to
`apps/backend` over the message types in `packages/commons`.

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
  frontend.tsx                 React entry point, loaded by index.html
  index.ts                     dev/prod server that serves index.html
  App.tsx                      three columns: folder, skill list, editor

  hooks/
    useSkillPane.ts            all client state; folds server events into it
    useSocket.ts               one socket, reconnecting with reported backoff
    useCountdown.ts            a ticking remainder, for the reconnect wait

  components/
    ErrorBanner.tsx            the one place a failure is explained
    sidebar/
      Sidebar.tsx              Personal, then one row per project
      AddWorkspaceForm.tsx     opens the folder picker
      FolderPicker.tsx         walks the backend's filesystem
      ProviderList.tsx         which agents this server can ask
      ConnectionStatus.tsx     whether the server is there
    skills/
      SkillList.tsx            grouped by scope, filtered
      ProviderMarks.tsx        one initial per agent that can see a skill
      SkillEditor.tsx          the SKILL.md, plus who honours each key
      NewSkillForm.tsx         scope first, because scope decides who reads it
      SkillProblems.tsx        the files that wouldn't parse

  lib/
    failure.ts                 a Failure as a heading and a colour
    markdown/                  a small renderer
```

## Settling rather than patching

Every write re-lists instead of patching state locally. A save isn't finished
when the file is written — it's finished when the agents can see it, and that
answer comes from walking their directories again. Guessing at it here would
show a skill as reaching Codex before anything had checked that it does.
