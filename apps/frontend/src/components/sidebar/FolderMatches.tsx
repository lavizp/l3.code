import type { FolderLocated } from "commons/types"

/**
 * Shown only when the OS dialog's answer wasn't enough on its own: either two
 * folders fit the description equally well, or the search never reached the
 * one that was chosen. Both are questions only the person who picked it can
 * settle, so both end in a choice rather than a guess.
 */
export function FolderMatches({
  located,
  onPick,
  onBrowse,
  onCancel
}: {
  located: FolderLocated
  onPick: (path: string) => void
  onBrowse: () => void
  onCancel: () => void
}) {
  const found = located.candidates.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 p-6"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-sm border border-rule bg-panel"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={found ? "Which one?" : "Folder not found"}
      >
        <div className="border-b border-rule px-3 py-2 font-mono text-[12px] text-dim">
          {found ? "Which one?" : "Couldn't find it"}
        </div>

        <div className="border-b border-rule px-3 py-2.5 text-[13px] leading-relaxed text-dim">
          {found ? (
            <>
              More than one folder called{" "}
              <span className="font-mono text-ink">{located.name}</span> matches
              what you picked.
              {located.truncated && " Only the closest few are listed."}
            </>
          ) : (
            <>
              Nothing under your home directory matches{" "}
              <span className="font-mono text-ink">{located.name}</span>. It may
              live somewhere the search doesn't reach — browse to it instead.
            </>
          )}
        </div>

        {found && (
          <div className="flex-1 overflow-y-auto p-1.5">
            {located.candidates.map(path => (
              <button
                key={path}
                className="block w-full truncate rounded-sm px-2 py-1.5 text-left font-mono text-[12px] text-ink hover:bg-raised"
                onClick={() => onPick(path)}
                title={path}
              >
                {path}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-rule p-3">
          <button
            className="rounded-sm px-2.5 py-1.5 font-mono text-[12px] text-dim hover:text-ink"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-sm bg-raised px-2.5 py-1.5 font-mono text-[12px] text-ink hover:bg-rule"
            onClick={onBrowse}
          >
            Browse instead
          </button>
        </div>
      </div>
    </div>
  )
}
