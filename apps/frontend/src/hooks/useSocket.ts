import { useCallback, useEffect, useRef, useState } from "react"
import type { IncommingMessageType, OutgoingMessageType } from "commons/types"

export type ConnectionStatus = "connecting" | "open" | "closed"

/**
 * Holds one socket to the agent server, reconnecting with backoff when it
 * drops. The message handler is attached synchronously at construction so
 * server state sent on connect can't arrive before we're listening.
 */
export function useSocket(url: string, onEvent: (event: OutgoingMessageType) => void) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting")
  const socketRef = useRef<WebSocket | null>(null)
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    let disposed = false
    let attempt = 0
    let retry: ReturnType<typeof setTimeout> | undefined

    function connect() {
      if (disposed) {
        return
      }
      const ws = new WebSocket(url)
      socketRef.current = ws
      setStatus("connecting")

      ws.onmessage = event => {
        try {
          handlerRef.current(JSON.parse(event.data) as OutgoingMessageType)
        } catch {
          console.error("Ignoring unparseable server message:", event.data)
        }
      }
      ws.onopen = () => {
        attempt = 0
        setStatus("open")
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => {
        if (disposed) {
          return
        }
        setStatus("closed")
        const delay = Math.min(1000 * 2 ** attempt++, 10_000)
        retry = setTimeout(connect, delay)
      }
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

  return { status, send }
}
