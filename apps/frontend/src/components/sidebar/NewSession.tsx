import { useState } from "react"
import type { AgentSummary } from "commons/types"

/**
 * Starting a session means picking the agent that will run it. The choice is
 * permanent — an agent can't be swapped in later, because a conversation
 * lives inside the provider that has been having it — so the button opens
 * the list rather than quietly defaulting to one.
 */
export function NewSession({
  agents,
  onCreate
}: {
  agents: AgentSummary[]
  onCreate: (agentId: string) => void
}) {
  const [choosing, setChoosing] = useState(false)

  function create(agentId: string) {
    setChoosing(false)
    onCreate(agentId)
  }

  // With a single agent there is nothing to decide.
  if (agents.length < 2) {
    return (
      <button
        className="w-full px-2 py-1.5 text-left font-mono text-[12px] text-dim hover:text-ink disabled:opacity-40"
        onClick={() => agents[0] && create(agents[0].id)}
        disabled={agents.length === 0}
      >
        + New session
      </button>
    )
  }

  if (!choosing) {
    return (
      <button
        className="w-full px-2 py-1.5 text-left font-mono text-[12px] text-dim hover:text-ink"
        onClick={() => setChoosing(true)}
      >
        + New session
      </button>
    )
  }

  return (
    <div className="py-1">
      <p className="px-2 font-mono text-[11px] text-dim">New session with</p>
      {agents.map(agent => (
        <button
          key={agent.id}
          className="w-full px-2 py-1.5 text-left font-mono text-[12px] text-ink hover:bg-raised"
          onClick={() => create(agent.id)}
        >
          {agent.label}
        </button>
      ))}
      <button
        className="w-full px-2 py-1 text-left font-mono text-[11px] text-dim hover:text-ink"
        onClick={() => setChoosing(false)}
      >
        Cancel
      </button>
    </div>
  )
}
