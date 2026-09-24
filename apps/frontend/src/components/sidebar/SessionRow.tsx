import { useRef, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { isRunning, sessionTitle, type UISession } from "../../lib/transcript"

const ICON =
  "shrink-0 rounded-sm p-1 text-dim opacity-0 hover:bg-rule hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"

/**
 * One session in the sidebar, and the two things you can do to it. Renaming
 * and deleting happen on the row itself rather than in a dialog, so the row
 * holds its height through both: the tree never shifts under the pointer,
 * and the session you're deciding about stays in front of you.
 */
export function SessionRow({
  session,
  active,
  onSelect,
  onRename,
  onDelete
}: {
  session: UISession
  active: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [mode, setMode] = useState<"idle" | "renaming" | "arming">("idle")
  const [draft, setDraft] = useState("")
  // Escape unmounts the input, which blurs it — without this the cancel
  // would arrive as a commit.
  const cancelling = useRef(false)

  const title = sessionTitle(session)
  const armed = mode === "arming"

  function startRenaming() {
    // Seed with the name it already has, so an accidental commit is a no-op.
    // A derived title isn't seeded: it belongs to the conversation, and
    // pre-filling it would quietly freeze it into a name.
    setDraft(session.name ?? "")
    cancelling.current = false
    setMode("renaming")
  }

  function commitRename() {
    if (cancelling.current) {
      cancelling.current = false
      return
    }
    setMode("idle")
    // Blank is meaningful: it clears the name and hands the row back to the
    // title derived from the conversation.
    if (draft.trim() !== (session.name ?? "")) {
      onRename(draft.trim())
    }
  }

  return (
    <div
      className={`group flex h-8 w-full items-center gap-1 rounded-sm pr-1 ${
        armed ? "bg-alarm/10" : active ? "bg-raised" : "hover:bg-panel"
      }`}
      onKeyDown={event => {
        if (event.key === "Escape" && mode !== "idle") {
          cancelling.current = true
          setMode("idle")
        }
      }}
    >
      {mode === "renaming" ? (
        <input
          autoFocus
          className="mx-1 h-6 min-w-0 flex-1 rounded-sm border border-rule bg-void px-1 text-[13px] text-ink placeholder:text-dim/70 outline-none focus:border-dim"
          value={draft}
          // The derived title as placeholder: clearing the field shows what
          // the row falls back to.
          placeholder={title}
          aria-label="Session name"
          onChange={event => setDraft(event.target.value)}
          onBlur={commitRename}
          onKeyDown={event => {
            if (event.key === "Enter") {
              commitRename()
            }
          }}
        />
      ) : (
        <>
          <button
            className={`min-w-0 flex-1 truncate px-2 text-left text-[13px] ${
              active ? "text-ink" : "text-dim group-hover:text-ink"
            }`}
            onClick={onSelect}
            disabled={armed}
          >
            {title}
          </button>

          {isRunning(session) && (
            <span
              className="pulse shrink-0 text-[10px] text-signal"
              aria-label="Running"
            >
              ◆
            </span>
          )}

          {armed ? (
            <>
              {/* Focus lands on the safe half, and keeps Escape working. */}
              <button
                autoFocus
                className="shrink-0 rounded-sm px-1 font-mono text-[11px] text-dim hover:text-ink"
                onClick={() => setMode("idle")}
              >
                Cancel
              </button>
              <button
                className="shrink-0 rounded-sm bg-alarm/15 px-1.5 py-0.5 font-mono text-[11px] text-alarm hover:bg-alarm hover:text-void"
                aria-label={`Delete ${title}, and everything in it`}
                onClick={onDelete}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                className={ICON}
                title="Rename session"
                aria-label="Rename session"
                onClick={startRenaming}
              >
                <Pencil size={13} strokeWidth={1.75} aria-hidden />
              </button>
              <button
                className={`${ICON} hover:bg-alarm/20 hover:text-alarm`}
                title="Delete session"
                aria-label="Delete session"
                onClick={() => setMode("arming")}
              >
                <Trash2 size={13} strokeWidth={1.75} aria-hidden />
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
