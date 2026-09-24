/**
 * A stream that is allowed to be slow, but not silent.
 *
 * An agent that stops responding doesn't close its stream — it just stops
 * producing events, and a `for await` over it waits forever. The turn never
 * ends, the caret never stops blinking, and the only way out is a reload.
 * This wrapper puts an upper bound on the quiet between two events; the
 * agent may take as long as it likes overall, as long as it keeps saying
 * something.
 */
export async function* withIdleTimeout<T>(
  source: AsyncIterable<T>,
  params: {
    /** How long a gap between events is allowed before we give up. */
    idleMs: number
    /**
     * Called once when the gap is exceeded, before the stream is closed.
     * Expected to abort whatever is producing the events: without that the
     * agent carries on working for a reply nobody is waiting for.
     */
    onStall: () => void
  }
): AsyncGenerator<T> {
  const iterator = source[Symbol.asyncIterator]()
  let stalled = false

  try {
    for (;;) {
      const next = iterator.next()
      // The race leaves this promise unobserved if the timer wins. Claim the
      // rejection now so a late failure isn't an unhandled one.
      next.catch(() => {})

      let timer: ReturnType<typeof setTimeout> | undefined
      const outcome = await Promise.race([
        next.then(result => ({ quiet: false as const, result })),
        new Promise<{ quiet: true }>(resolve => {
          timer = setTimeout(() => resolve({ quiet: true }), params.idleMs)
        })
      ])
      clearTimeout(timer)

      if (outcome.quiet) {
        stalled = true
        params.onStall()
        return
      }
      if (outcome.result.done) {
        return
      }
      yield outcome.result.value
    }
  } finally {
    // On a stall the source is mid-`next` and only the abort will free it;
    // closing it is best-effort either way, and its rejection is not ours.
    if (!stalled) {
      void Promise.resolve(iterator.return?.()).catch(() => {})
    }
  }
}
