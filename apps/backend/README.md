# backend

A websocket server that lists, writes and links `SKILL.md` files. It speaks
the message types in `packages/commons` and holds the folder list in MongoDB.

```bash
bun dev     # bun --watch index.ts
bun start
```

## Layout

```
index.ts                   opens the port, then connects to Mongo
config.ts                  every env-dependent knob, read once

transport/
  server.ts                accepts clients, sends the initial state
  connection.ts            one client, and the only thing that writes to it
  router.ts                one handler per incoming message type

skills/
  types.ts                 the SkillProvider seam
  registry.ts              register / look up providers
  index.ts                 registers the built-ins
  scan.ts                  find the SKILL.md directories under a root
  claude-code.ts           filesystem walk of Claude Code's roots
  codex.ts                 codex app-server's own skills/list

services/
  skills.ts                merge the providers' answers; create/read/write/delete
  frontmatter.ts           split and rejoin a SKILL.md
  links.ts                 symlinks, created and removed carefully
  codex-app-server.ts      a long-lived JSON-RPC child process
  directory.ts             filesystem walking for the folder picker

repositories/
  workspaces.ts            the project list
  failure.ts               database trouble, told apart from a bad request

errors.ts                  FailureError, and whatever was thrown as a Failure
```

## The seam

`SkillProvider` does two things: say where its agent looks for skills, and
make a directory in the shared store appear in one of those places. It does
*not* parse `SKILL.md` — two agents routinely find the same file by different
routes, and parsing once, centrally, after the paths have been resolved and
grouped is the only way the list ends up with one row per skill instead of
one per sighting.

Adding an agent is a new file plus one `registerProvider` call. Nothing
upstream of `skills/` changes.

## Writing

A new skill is written once, to `.agents/skills`, then handed to every
provider to link into place. `.agents/skills` is the one directory more than
one agent reads by itself, so it is the one written to; the providers that
don't read it get a relative symlink.

Two rules in [links.ts](services/links.ts) bound what this does to somebody's
`~/.claude` and `~/.codex`: it creates only links, and removes only links it
has checked point at the skill being deleted. A directory sitting where a
link should go is somebody's actual skill.

## The path guard

`assertSkillPath` in [services/skills.ts](services/skills.ts) is the boundary
where a path off the wire becomes a file this server writes to. It has to be
a `SKILL.md`, and it has to sit under somewhere deliberately in scope — a
registered project, or the home directory's own agent folders. During a
database outage the project list is unavailable, and a path that matches
neither is reported as the outage rather than as an unknown path.
