# l3.code

A local web pane for the skills your coding agents read. Open it, and every
`SKILL.md` on the machine is in one list — the ones you wrote, the ones a
plugin installed, the ones the agents shipped with — each row saying which
agents can actually see it, and opening into an editor.

A skill is the part of a coding agent somebody taught it: a directory holding
a `SKILL.md`, YAML frontmatter naming and describing it, markdown underneath.
[Claude Code](https://claude.com/claude-code) and
[Codex](https://developers.openai.com/codex) read that same shape and disagree
only about where to look and which frontmatter keys they honour.

## The problem it solves

Skills accumulate where nobody looks: `~/.claude/skills`, `~/.codex/skills`,
`.claude/skills` in one repo, a plugin cache four directories deep. A skill
sitting in the right folder for one agent and invisible to another looks
identical on disk. The only way to find out is to ask each agent, and that
answer belongs next to the skill rather than in a separate investigation.

```
browser                       apps/backend                        your machine
┌──────────────┐  websocket  ┌────────────────┐    Sighting[]    ┌───────────┐
│  skill pane  │ ──────────► │ transport/     │ ◄─────────────── │ skill     │
│  list/editor │             │ services/      │                  │ providers │
│              │ ◄────────── │ skills/*       │ ───────────────► │           │
└──────────────┘  Skill[]    └────────────────┘   write + link   └───────────┘
                                     │                                 │
                                     ▼                                 ▼
                                  MongoDB                     .agents/skills/
                           (the project list only)            ~/.claude/skills/
                                                              ~/.codex/skills/
```

Each provider reports where its agent looks. The paths come back as
*sightings*, are resolved through symlinks and grouped by real file, so one
skill two agents found by two routes is one row with two badges rather than
two rows. The `SKILL.md` is parsed once, centrally, after that grouping.

## Quick start

With Docker, nothing else needs installing — Bun, MongoDB, and the Claude
Code and Codex CLIs all come in the containers:

```bash
docker compose up -d --build
```

Open <http://localhost:3000>. Your personal skills are already listed; add a
folder to see a project's.

The backend container mounts your home directory at the same path it has on
the host and runs as your user. Both matter: plugin manifests and skill
symlinks hold absolute host paths, and a skill the pane writes should belong
to you rather than root. Two consequences:

- **Projects must live under your home directory**, because that's all the
  container can see. Mount anything else into `backend` in
  `docker-compose.yml` at its own path.
- **If `id -u` isn't 1000**, put your IDs in a `.env` beside
  `docker-compose.yml` before starting it:

  ```bash
  printf 'UID=%s\nGID=%s\n' "$(id -u)" "$(id -g)" > .env
  ```

The agents the pane reports as installed are the ones in the image, not on
your machine. Codex's skill list comes from the image's `codex app-server`
reading your `~/.codex`. It's installed at the latest version on every build,
and you can pin it with `--build-arg CODEX_VERSION=…`. MongoDB is 7 rather than
8 or later, because those refuse to start on Linux 6.19 and newer.

`docker compose down` stops it. The project list is kept in the `mongo-data`
volume.

### Without Docker

Prerequisites:

- [Bun](https://bun.com) 1.4+ and Node 24+
- A MongoDB instance, local or Atlas. It holds the list of project folders,
  and nothing else — skills are files.
- Whichever agents you want listed, installed here. Nothing needs to be
  signed in: reading skills is a filesystem question.

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

That's `turbo run dev` — the backend's websocket on `:8080`, the frontend on
Bun's dev server at `:3000` with HMR. Open it and your personal skills are
already listed; add a folder to see a project's.

The folder picker browses the **backend's** filesystem, not the browser's: a
browser never discloses an absolute path, and an absolute path is what the
agents need. Run the two on the same machine.

## Two views

The sidebar has **Personal** and a row per project you've added, and they are
the same screen asking two different questions.

**Personal** is what every agent reads no matter where you work: your own
skills in your home directory, plus the plugin, synced and bundled ones that
live there too.

**A project** is the repo's own skills — the ones committed alongside the
code. The server can see everything an agent would read from inside that
folder, personal skills included, but burying the handful that belong to the
repo under dozens that don't answers the wrong question. Those are one click
away under Personal, so a project view shows the repo's, and a new skill
written there goes into the repo.

## Where a skill goes

Two decisions, and the "new skill" form asks only the ones that are still
open: **how far it travels** — this repo or everywhere — and **who reads it**.

Shared is one file plus a link per agent that needs one:

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
<project>/.claude/skills/<name>/SKILL.md   Claude Code, this repo
<project>/.codex/skills/<name>/SKILL.md    Codex, this repo
~/.claude/skills/<name>/SKILL.md           Claude Code, everywhere
~/.codex/skills/<name>/SKILL.md            Codex, everywhere
```

`.agents/skills` is the one directory more than one agent has agreed to look
in, which is why the shared ones go there. Codex reads a project's copy
natively; Claude Code doesn't, and gets a **relative** symlink instead —
relative so a repo that's cloned or moved keeps working.

Which of the three a skill is can't be read off the disk afterwards, so the
list says it: every row carries its reach and a badge per agent, and the
filter above the list narrows to one agent's view. The badges read `CC` and
`CX` rather than initials — both agents' names begin with a C.

Project skills are files in your repo. Whether to commit the `.claude/skills`
symlinks beside them is your call: committing them means a fresh clone works
for Claude Code without opening this app, and costs a directory of symlinks
in the tree.

## Scope and origin

Two axes, kept separate on purpose. **Scope** is how far a skill travels:
`project` or `user`. **Origin** is who put it there, and it's what the list
groups by — "why is the agent doing that" is a different conversation for
each, and only the first two are anybody's to change:

- **This project** — yours, in the repo.
- **Personal** — yours, in your home directory.
- **From plugins** — installed by a plugin, replaced when it updates.
- **Synced from your account** — re-downloaded on a timer, so an edit has a
  short life.
- **The agent's own** — shipped with the agent itself.

The last three are shown and never written. The editor says which, and what
would happen to an edit, rather than a bare "read-only" that reads as this
app being unable to.

Collapsing the two axes into one is the mistake this replaced: a plugin's
skills install under your home directory and so do your own, so a list keyed
on location alone can't tell an agent's defaults from the ones you wrote.

## Frontmatter

Both agents ignore frontmatter keys they don't recognise, in silence. That's
what lets one file serve both — and it's also why `allowed-tools` looks like
it works everywhere when it works in exactly one place. The editor marks
which agent acts on each key that's present:

| Key                                | Claude Code | Codex |
| ---------------------------------- | ----------- | ----- |
| `name`, `description`              | ✓           | ✓     |
| `allowed-tools`                    | ✓           |       |
| `argument-hint`                    | ✓           |       |
| `disable-model-invocation`         | ✓           |       |
| `user-invocable`                   | ✓           |       |
| `model`, `version`, `license`      | ✓           |       |
| `metadata`                         |             | ✓     |

The editor is the file itself rather than a form over those keys, deliberately:
a form can only represent what it knows about, and would quietly drop anything
it didn't on save — including keys belonging to an agent this app hasn't been
taught about yet.

## Adding an agent

Nothing outside [apps/backend/skills/](apps/backend/skills/) knows which
agents exist. Write an adapter against `SkillProvider`:

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
in the sidebar, as a badge beside every skill, as a filter above the list, as
a "Cursor only" choice when writing one, and in the frontmatter table. A
provider says where its agent looks, where that agent keeps its own, and how
to link a shared directory into place; it deliberately doesn't parse
`SKILL.md`, because two agents routinely find the same file and parsing once
after deduplication is what keeps the list one row per skill.

The two built in take different routes to the same answer, which is the point
of the seam:

- [claude-code.ts](apps/backend/skills/claude-code.ts) walks the filesystem.
  The Agent SDK's `supportedCommands()` lists what a session can see but
  reports no path, and a pane that can't say where a skill lives can't open
  it. Its roots are stable and few, so nothing here spawns the agent.
- [codex.ts](apps/backend/skills/codex.ts) asks `codex app-server` over
  JSON-RPC. Codex looks in more places than are worth guessing at, and which
  are live depends on config this app doesn't read, so `skills/list` answers
  with the path, the scope and the owning plugin for each.

## When it goes wrong

No failure here is a string. Every one is a `Failure` from
[commons/errors.ts](packages/commons/errors.ts): a `kind` the UI branches on,
one sentence for the person, and the underlying wording kept aside as
`detail`. What that buys, case by case:

- **A `SKILL.md` won't parse.** A skill with broken frontmatter doesn't
  announce itself — the agent simply never offers it, which looks exactly
  like never having written it. Those files are counted at the foot of the
  list with the path and the parser's complaint, rather than dropped.
- **A skill loses its name or description.** Refused on save. An agent
  decides whether a skill applies from those two fields alone, so a skill
  missing either will never be chosen, and saving it silently looks identical
  to saving one that works.
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
  time — they're files, and the database only holds the project list.

## Configuration

Backend `.env`, loaded by Bun (no dotenv):

| Variable           | Default      | Meaning                                           |
| ------------------ | ------------ | ------------------------------------------------- |
| `DB_URL`           | — (required) | MongoDB connection string                         |
| `PORT`             | `8080`       | Websocket port                                    |
| `CODEX_COMMAND`    | `codex`      | The Codex CLI to run `app-server` with            |
| `CODEX_TIMEOUT_MS` | `30000`      | How long to wait for it to answer                 |
| `DB_TIMEOUT_MS`    | `5000`       | How long to wait for Mongo before calling it down |
| `DEBUG`            | unset        | Log what the agents' own processes print          |

The frontend's server URL is in [src/config.ts](apps/frontend/src/config.ts).

## Run it on localhost only

The websocket server has no authentication, and it reads and writes `SKILL.md`
files under your home directory and your projects. Anyone who can reach the
port can browse the filesystem through the folder picker, register any
absolute path as a project, and write a skill your agents will then read —
which is as good as writing their instructions. Don't expose the backend port
to a network you don't trust.

## Layout

```
apps/
  backend/     websocket server; lists, writes and links skills
    transport/     connection, router, server
    services/      skills, frontmatter, links, directory
    skills/        the provider seam and the two adapters
    repositories/  the project list
  frontend/    React pane — projects, skill list, SKILL.md editor

packages/
  commons/     the wire protocol and the Skill model
  db/          the Workspace schema — the folder list, and nothing else
  ui/          shared React primitives
  eslint-config/, typescript-config/
```

## Scripts

```bash
bun dev               # turbo run dev — both apps, watch mode
bun run build
bun run check-types
bun run lint
```

Backend tests are Bun's runner, next to what they cover:

```bash
cd apps/backend && bun test
```
