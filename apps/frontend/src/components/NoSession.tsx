/** Shown when nothing is open — the app's resting state. */
export function NoSession() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-[15px] text-ink">No session open</p>
      <p className="max-w-sm text-[14px] leading-relaxed text-dim">
        Pick a session in the sidebar, or start a new one inside a workspace.
      </p>
    </div>
  )
}
