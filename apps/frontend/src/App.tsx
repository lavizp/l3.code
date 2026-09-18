import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [ws, setWs] = useState(new WebSocket("ws://localhost:8080"))
  useEffect(() => {
    ws.onopen = () => {
      if (ws) {
        ws.send("hi there")
      }
    }
  }, [ws])


  return (
    <>hello
    </>
  )
}

export default App
