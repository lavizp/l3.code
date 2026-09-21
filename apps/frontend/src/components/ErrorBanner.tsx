export function ErrorBanner({
  message,
  onDismiss
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div className="flex items-start gap-3 border-b border-alarm/40 bg-alarm/10 px-6 py-2">
      <p className="flex-1 font-mono text-[12px] text-alarm">{message}</p>
      <button
        className="font-mono text-[12px] text-alarm/70 hover:text-alarm"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  )
}
