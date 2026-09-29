# commons

The wire protocol, and the model both ends share.

- [`skills.ts`](skills.ts) — `Skill`, `SkillScope`, `SkillSighting`,
  `ProviderSummary`, and `FRONTMATTER_SUPPORT`: which agent acts on which
  frontmatter key.
- [`incomming.ts`](incomming.ts) — what a client may ask for, as zod schemas
  the router validates against.
- [`outgoing.ts`](outgoing.ts) — what the server says back.
- [`errors.ts`](errors.ts) — `Failure`: a kind the UI branches on, one
  sentence for the person, and the underlying wording kept aside as `detail`.

A skill's identity is the resolved path of its `SKILL.md`, not its name.
Names collide across scopes, and two agents that found the same file through
different directories have to come out as one skill rather than two.
