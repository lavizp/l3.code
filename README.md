# l3.code

A self-hosted web UI for the skills your coding agents read. Point it at a
folder, and every `SKILL.md` on the machine shows up in one list — the ones
in that repo, the ones in your home directory, and the ones the agents
themselves shipped with — with, beside each, which agents can actually see
it.

Skills are the part of a coding agent somebody taught it: a directory
holding a `SKILL.md`, YAML frontmatter naming and describing it, markdown
underneath. [Claude Code](https://claude.com/claude-code) and
[Codex](https://developers.openai.com/codex) read the same shape and
disagree only about where to look.

So a skill written here is written for whoever it's for. A shared one goes
**once** into `.agents/skills` and is linked into each agent's own directory
— one file to edit rather than a copy per agent that drifts. One that leans
on a single agent's tools goes straight into that agent's folder, where no
other agent looks.

## What it's for

Skills accumulate in places nobody looks at: `~/.claude/skills`,
`~/.codex/skills`, `.claude/skills` in one repo, a plugin cache four levels
deep. A skill sitting in the right folder for one agent and invisible to
another looks identical on disk. The only way to tell is to ask each agent,
and that answer belongs next to the skill.

```
browser                       apps/backend                        your machine
┌──────────────┐  websocket  ┌────────────────┐    Sighting[]    ┌───────────┐
│  skill pane  │ ──────────► │ router         │ ◄─────────────── │ skill     │
│  list/editor │             │ services/skills│                  │ provider  │
│              │ ◄────────── │ skills/*       │ ───────────────► │           │
└──────────────┘  Skill[]    └────────────────┘   write + link   └───────────┘
                                     │                                 │
                                     ▼                                 ▼
                                  MongoDB                     .agents/skills/
                              (the folder list)               ~/.claude/skills/
                                                              ~/.codex/skills/
```

Each provider says where its agent looks; the paths it reports are resolved
and grouped by real file, so one skill two agents found by two routes is one
row with two badges rather than two rows. The `SKILL.md` is parsed once,
centrally, after that grouping.

## Quick start

Prerequisites:

- [Bun](https://bun.com) 1.4+ and Node 24+
- A MongoDB instance (local or Atlas) — it holds the list of projects, and
  nothing else
- Whichever agents you want listed, installed on this machine. Nothing needs
  to be signed in: reading skills is a filesystem question.

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

That's `turbo run dev` — backend on `:8080`, frontend on Bun's dev server
with HMR. Open the frontend, and the skills you carry everywhere are already
listed; choose a folder to add a project's own.

The folder picker browses the *backend's* filesystem, not yours: a browser
never discloses an absolute path, and an absolute path is what the agents
need. Run the two on the same machine.

## Who reads what

Two questions when you write a skill, and the pane asks both: **how far it
travels** — this repo, or everywhere — and **who reads it**.

Shared, one file and a link per agent that needs one:

```
<project>/.agents/skills/<name>/SKILL.md   the file you edit
<project>/.claude/skills/<name>   ── symlink ──┘   (Claude Code)
                                                   (Codex reads .agents itself)

~/.agents/skills/<name>/SKILL.md           personal, every project
~/.claude/skills/<name>   ── symlink ──┐
~/.codex/skills/<name>    ── symlink ──┘
```

For one agent, straight into that agent's own directory, no link at all:

```
<project>/.claude/skills/<name>/SKILL.md   Claude Code only
<project>/.codex/skills/<name>/SKILL.md    Codex only
~/.claude/skills/<name>/SKILL.md           Claude Code, every project
~/.codex/skills/<name>/SKILL.md            Codex, every project
```

`.agents/skills` is the one directory more than one agent has agreed to look
in, which is why it's where the shared ones go. Codex reads a project's copy
natively; Claude Code doesn't, and gets a relative symlink instead — relative
so a repo that's cloned or moved keeps working.

Which of the three a skill is can't be seen from the disk afterwards, so the
list says it: every row carries `shared`, `Claude Code only` or `Codex only`,
with a badge per agent, and the filter above the list narrows to one agent's
view. The badges read `CC` and `CX` rather than initials — both agents' names
begin with a C.

Project skills are files in your repo. Whether to commit the `.claude/skills`
symlinks alongside them is your call: committing them means a fresh clone
works for Claude Code without opening this app, and costs a directory of
symlinks in the tree.

## Frontmatter

Both agents ignore frontmatter keys they don't recognise, in silence. That's
what lets one file serve all of them — and it's also why `allowed-tools`
looks like it works everywhere when it works in exactly one place. The editor
says which agent acts on each key that's present:

| Key                        | Claude Code | Codex |
| -------------------------- | ----------- | ----- |
| `name`, `description`      | ✓           | ✓     |
| `allowed-tools`            | ✓           |       |
| `argument-hint`            | ✓           |       |
| `disable-model-invocation` | ✓           |       |
| `user-invocable`           | ✓           |       |
| `metadata`                 |             | ✓     |

The editor is the file itself rather than a form over those keys, on purpose:
a form can only represent what it knows about, and would quietly drop
anything it didn't on save — including keys belonging to an agent this app
hasn't been taught about yet.

## Adding an agent

Nothing outside `apps/backend/skills/` knows which agents exist. Write an
adapter against `SkillProvider`:

```ts
// skills/cursor.ts
import type { SkillProvider } from "./types"

export const cursor: SkillProvider = {
  id: "cursor",
  label: "Cursor",
  short: "CU",
  readsSharedRoot: false,
  probe: async () => ({ available: Boolean(Bun.which("cursor")) }),
  ownRoot: (scope, cwd) => join(scope === "project" ? cwd! : homedir(), ".cursor", "skills"),
  list: async cwd => ({ sightings: [], problems: [] }),
  project: async (dir, scope, cwd) => {},
  unproject: async (dir, scope, cwd) => {}
}
```

Register it in [skills/index.ts](apps/backend/skills/index.ts) and it appears
in the sidebar, as a badge beside every skill, as a filter above the list,
as a "Cursor only" choice when writing one, and in the frontmatter table. A
provider says where its agent looks, where that agent keeps its own, and how
to link a shared directory into place; it deliberately doesn't parse
`SKILL.md`, because two agents routinely find the same file and parsing once
after deduplication is what keeps the list one row per skill.

The two built in take different routes to the same answer, which is the point
of the seam:

- [claude-code.ts](apps/backend/skills/claude-code.ts) walks the filesystem.
  The Agent SDK's `supportedCommands()` will list what a session can see, but
  reports no path, and a pane that can't say where a skill lives can't open
  it. Its roots are stable and few, so nothing here spawns the agent —
  listing costs nothing.
- [codex.ts](apps/backend/skills/codex.ts) asks `codex app-server` over
  JSON-RPC. Codex looks in more places than are worth guessing at and which
  are live depends on config this app doesn't read, so `skills/list` answers
  with the path, the scope and the owning plugin for each.

## Scope and origin

Two separate axes, kept separate on purpose. **Scope** is how far a skill
travels: `project` or `user`. **Origin** is who put it there, and it's what
the list groups by — "why did the agent do that" is a different conversation
for each, and only the first two are anybody's to change:

- **This project** — yours, in the repo.
- **Personal** — yours, in your home directory.
- **From plugins** — provided by an installed plugin, replaced when it updates.
- **Synced from your account** — re-downloaded on a timer, so an edit has a
  short life.
- **The agent's own** — shipped with the agent itself.

The last three are shown and never written. The editor says which, and what
would happen to an edit, rather than a bare "read-only" that reads as this
app being unable to.

Collapsing these into one axis is the mistake this replaced: a plugin's
skills install under your home directory and so do your own, so a list keyed
on location alone can't tell the agent's defaults from the ones you wrote.

## Configuration

Backend `.env`, loaded by Bun (no dotenv):

| Variable            | Default      | Meaning                                       |
| ------------------- | ------------ | --------------------------------------------- |
| `DB_URL`            | — (required) | MongoDB connection string                     |
| `PORT`              | `8080`       | Websocket port                                |
| `CODEX_COMMAND`     | `codex`      | The Codex CLI to run `app-server` with        |
| `CODEX_TIMEOUT_MS`  | `30000`      | How long to wait for it to answer             |
| `DB_TIMEOUT_MS`     | `5000`       | How long to wait for Mongo before calling it down |
| `DEBUG`             | unset        | Log what the agents' own processes print      |

The frontend's server URL is in [src/config.ts](apps/frontend/src/config.ts).

## Layout

```
apps/
  backend/     websocket server; lists, writes and links skills
  frontend/    React pane — projects, skill list, SKILL.md editor

packages/
  commons/     the wire protocol and the Skill model
  db/          the Workspace schema — the folder list, and nothing else
  ui/          shared React primitives
  eslint-config/, typescript-config/
```

## When it goes wrong

Nothing here reports a failure as a string. Every failure is a `Failure` from
[commons/errors.ts](packages/commons/errors.ts): a `kind` the UI branches on,
one sentence for the person, and the underlying wording kept aside as
`detail`. What that buys, case by case:

- **A `SKILL.md` won't parse.** A skill with broken frontmatter doesn't
  announce itself — the agent simply never offers it, which looks exactly
  like never having written it. Those files are counted at the foot of the
  list with the path and the parser's complaint, rather than dropped.
- **A skill loses its name or description.** Refused on save. An agent
  decides whether a skill applies from those two fields alone, so a skill
  missing either will never be chosen, and saving it silently looks
  identical to saving one that works.
- **An agent isn't installed.** Reported per provider in the sidebar and in
  every badge. "You have no skills" and "one of the two places they live
  can't be read" are different sentences.
- **`codex app-server` won't start.** That provider's skills are missing from
  the list and the reason is at the foot of it; the other agent's are still
  shown. One agent being unreachable doesn't fail the request.
- **Something is already where a link should go.** Refused. A directory at a
  skill path is somebody's actual skill, and replacing it with a pointer
  elsewhere would delete their work to make a listing tidier. Deleting is the
  mirror image: a link is only removed once it's been checked that it points
  at the skill being deleted.
- **The database is down.** The port opens before Mongo is reached, so the UI
  connects and is told what's wrong. Personal skills keep listing the whole
  time — they're files, and the database only holds the folder list.

## Run it on localhost only

The websocket server has no authentication, and it reads and writes
`SKILL.md` files under your home directory and your projects. Anyone who can
reach the port can browse the filesystem through the folder picker, register
any absolute path as a project, and write a skill your agents will then
read — which is as good as writing their instructions. Don't expose the
backend port to a network you don't trust.

## Scripts

```bash
bun dev           # turbo run dev — both apps, watch mode
bun run build
bun run check-types
bun run lint
```
