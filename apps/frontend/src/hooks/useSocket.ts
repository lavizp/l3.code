import { useCallback, useEffect, useRef, useState } from "react"
import type { IncommingMessageType, OutgoingMessageType } from "commons/types"

export type ConnectionStatus = "connecting" | "open" | "closed"

export type SocketState = {
  status: ConnectionStatus
  /** Consecutive failed attempts since the last time we were connected. */
  attempts: number
  /** When the next automatic attempt fires, while we're waiting for it. */
  retryAt: number | null
  /**
   * Whether this page has ever been connected. A first attempt that fails
   * means the server isn't running; a later one means it went away, and
   * those want different words.
   */
  everConnected: boolean
}

const MAX_BACKOFF_MS = 10_000

/**
 * Holds one socket to the agent server, reconnecting with backoff when it
 * drops. The message handler is attached synchronously at construction so
 * server state sent on connect can't arrive before we're listening.
 *
 * The backoff is reported rather than hidden: a client that says
 * "reconnecting" with no sense of when is indistinguishable from one that
 * has quietly given up, so callers get the attempt count and the time of the
 * next try, plus a way to skip the wait.
 */
export function useSocket(
  url: string,
  handlers: {
    onEvent: (event: OutgoingMessageType) => void
    /**
     * The connection dropped while it was open. Anything the client was
     * waiting on will never arrive, so this is where it gives up on it.
     */
    onDropped?: () => void
  }
) {
  const [state, setState] = useState<SocketState>({
    status: "connecting",
    attempts: 0,
    retryAt: null,
    everConnected: false
  })

  const socketRef = useRef<WebSocket | null>(null)
  const latest = useRef(handlers)
  latest.current = handlers
  // Lets the retry button interrupt the backoff timer from outside the effect.
  const reconnectRef = useRef<() => void>(() => {})

  useEffect(() => {
    let disposed = false
    let attempt = 0
    let retry: ReturnType<typeof setTimeout> | undefined
    // Whether the socket that is closing had ever opened. Only one that had
    // can have left something in flight.
    let wasOpen = false

    function connect() {
      if (disposed) {
        return
      }
      clearTimeout(retry)

      const ws = new WebSocket(url)
      socketRef.current = ws
      setState(prev => ({ ...prev, status: "connecting", retryAt: null }))

      ws.onmessage = event => {
        try {
          latest.current.onEvent(JSON.parse(event.data) as OutgoingMessageType)
        } catch {
          console.error("Ignoring unparseable server message:", event.data)
        }
      }
      ws.onopen = () => {
        attempt = 0
        wasOpen = true
        setState({
          status: "open",
          attempts: 0,
          retryAt: null,
          everConnected: true
        })
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => {
        if (disposed) {
          return
        }
        const dropped = wasOpen
        wasOpen = false

        const delay = Math.min(1000 * 2 ** attempt++, MAX_BACKOFF_MS)
        setState(prev => ({
          ...prev,
          status: "closed",
          attempts: attempt,
          retryAt: Date.now() + delay
        }))
        // Only a socket that was actually open can have dropped; a failed
        // attempt never had anything in flight to give up on.
        if (dropped) {
          latest.current.onDropped?.()
        }
        retry = setTimeout(connect, delay)
      }
    }

    reconnectRef.current = () => {
      attempt = 0
      socketRef.current?.close()
      connect()
    }

    connect()
    return () => {
      disposed = true
      clearTimeout(retry)
      socketRef.current?.close()
    }
  }, [url])

  const send = useCallback((message: IncommingMessageType) => {
    const ws = socketRef.current
    if (ws?.readyState !== WebSocket.OPEN) {
      return false
    }
    ws.send(JSON.stringify(message))
    return true
  }, [])

  /** Try again now instead of waiting out the backoff. */
  const reconnect = useCallback(() => reconnectRef.current(), [])

  return { ...state, send, reconnect }
}
