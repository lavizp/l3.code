# One image for both apps; docker-compose.yml picks which one a container runs.
#
# Node is the base rather than Bun because the agent CLIs are npm packages
# with `#!/usr/bin/env node` launchers, and the backend has to be able to run
# them: Codex's skills come from `codex app-server`, and both providers report
# an agent as missing when its command isn't on PATH.
FROM node:24-bookworm-slim

COPY --from=oven/bun:1.4.0 /usr/local/bin/bun /usr/local/bin/bun

# git because Codex works out a repo's skill roots relative to its git root.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG CODEX_VERSION=latest
ARG CLAUDE_CODE_VERSION=latest
RUN npm install -g @openai/codex@${CODEX_VERSION} @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
  && npm cache clean --force

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

# The container runs as the host user with the host's home mounted, so Bun's
# transpiler cache would otherwise land in their ~/.cache.
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
