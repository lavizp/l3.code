import { useState } from "react"
import type { ToolBlock } from "commons/types"

/** Plain-language names for the tools the agent can reach for. */
const TOOL_LABELS: Record<string, string> = {
  Read: "Read",
  Edit: "Edit",
  Write: "Write",
  Glob: "Find",
  Grep: "Search",
  Bash: "Run"
}

/** The argument worth showing on a collapsed row — usually the file. */
function toolTarget(input: unknown, workspacePath?: string): string {
  if (!input || typeof input !== "object") {
    return ""
  }
  const obj = input as Record<string, unknown>
  const candidate =
    obj.file_path ?? obj.path ?? obj.pattern ?? obj.command ?? obj.query ?? ""
  let value = typeof candidate === "string" ? candidate : ""
  if (workspacePath && value.startsWith(workspacePath)) {
    value = value.slice(workspacePath.length).replace(/^\//, "") || "."
  }
  return value
}

function StatusMark({ status }: { status: ToolBlock["status"] }) {
  if (status === "running") {
    return <span className="pulse text-signal" aria-label="Running">◆</span>
  }
  if (status === "error") {
    return <span className="text-alarm" aria-label="Failed">✕</span>
  }
  return <span className="text-dim" aria-label="Done">✓</span>
}

export function ToolRow({
  block,
  workspacePath
}: {
  block: ToolBlock
  workspacePath?: string
}) {
  const [open, setOpen] = useState(false)
  const label = TOOL_LABELS[block.name] ?? block.name
  const target = toolTarget(block.input, workspacePath)

  return (
    <div
      className={`border-l-2 pl-3 ${
        block.status === "running" ? "border-signal" : "border-rule"
      }`}
    >
      <button
        className="group flex w-full items-baseline gap-2 py-1 text-left font-mono text-[13px] hover:bg-panel/60"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="w-3 shrink-0 text-[11px]">
          <StatusMark status={block.status} />
        </span>
        <span className="shrink-0 font-medium text-ink">{label}</span>
        <span className="min-w-0 flex-1 truncate text-dim">{target}</span>
        <span
          className={`shrink-0 text-dim transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ›
        </span>
      </button>

      {open && (
        <div className="mb-2 space-y-2 pb-1 pl-5">
          <pre className="max-h-40 overflow-auto rounded-sm bg-panel p-2 font-mono text-[12px] leading-relaxed text-dim">
            {JSON.stringify(block.input, null, 2)}
          </pre>
          {block.result !== undefined && (
            <pre
              className={`max-h-64 overflow-auto rounded-sm bg-panel p-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap ${
                block.status === "error" ? "text-alarm" : "text-ink/80"
              }`}
            >
              {block.result || "No output."}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
