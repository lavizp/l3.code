import { useState, useEffect } from "react"
export function useSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080")
    setSocket(ws)
    setLoading(false)
    ws.onopen = () => setLoading(false)
    ws.onclose = () => setLoading(true)
    return () => ws.close()
  }, [])

  return { socket, loading }
}
