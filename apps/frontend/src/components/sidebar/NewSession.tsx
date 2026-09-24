import type { AgentSummary } from "commons/types"

const CHIP =
  "rounded-sm border border-transparent px-1.5 py-1 font-mono text-[12px] text-dim hover:border-rule hover:bg-raised hover:text-ink"

/**
 * Starting a session means picking the agent that will run it, and the
 * choice is permanent — a conversation lives inside the provider that has
 * been having it, so it can't be swapped in later.
 *
 * With a handful of agents there's nothing to gain by hiding that behind a
 * menu: every choice sits on one row, and clicking one starts the session.
 * No disclosure step means no cancelling and nothing shifting underneath
 * the workspaces below.
 */
export function NewSession({
  agents,
  onCreate
}: {
  agents: AgentSummary[]
  onCreate: (agentId: string) => void
}) {
  if (agents.length === 0) {
    return (
      <p className="px-2 py-1.5 font-mono text-[12px] text-dim/60">
        No agents to run a session.
      </p>
    )
  }

  // With one agent there is nothing to choose between, so don't make anyone
  // read its name to click it.
  if (agents.length === 1) {
    return (
      <div className="mt-0.5 px-1">
        <button
          className={`${CHIP} w-full text-left`}
          onClick={() => onCreate(agents[0]!.id)}
        >
          <span className="text-dim">+</span> New session
        </button>
      </div>
    )
  }

  return (
    <div className="mt-0.5 flex flex-wrap gap-1 px-1">
      {agents.map(agent => (
        <button
          key={agent.id}
          className={CHIP}
          title={`New session with ${agent.label}`}
          onClick={() => onCreate(agent.id)}
        >
          <span className="text-dim">+</span> {agent.label}
        </button>
      ))}
    </div>
  )
}
