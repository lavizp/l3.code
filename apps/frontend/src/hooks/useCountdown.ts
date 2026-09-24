import { useEffect, useState } from "react"

/**
 * Milliseconds left until `at`, re-rendered once a second.
 *
 * A limit that says "resets at 16:40" is a promise the UI has to keep: the
 * send button needs to come back on its own at 16:40, and nothing else in
 * the app is going to re-render at that moment to notice.
 *
 * Null when there's nothing to count down to, zero once it has passed.
 */
export function useCountdown(at: number | null | undefined): number | null {
  const [remaining, setRemaining] = useState(() =>
    at ? Math.max(0, at - Date.now()) : null
  )

  useEffect(() => {
    if (!at) {
      setRemaining(null)
      return
    }

    const tick = () => setRemaining(Math.max(0, at - Date.now()))
    tick()

    // Stop once it's up: a timer firing every second forever is a timer
    // nobody turned off.
    if (at <= Date.now()) {
      return
    }
    const timer = setInterval(() => {
      const left = at - Date.now()
      setRemaining(Math.max(0, left))
      if (left <= 0) {
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [at])

  return remaining
}
