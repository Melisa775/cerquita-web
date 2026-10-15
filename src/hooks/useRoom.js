import { useCallback, useEffect, useRef, useState } from 'react'
import { socketUrl } from '../lib/api'

/**
 * Conexión en tiempo real con una sala.
 * El servidor envía la foto completa del estado en cada cambio; aquí solo
 * se guarda la última y se reconecta si se cae la conexión.
 */
export function useRoom(code, name) {
  const [room, setRoom] = useState(null)
  const [status, setStatus] = useState('connecting') // connecting | open | reconnecting | closed
  const [error, setError] = useState(null)
  const [fatal, setFatal] = useState(null)
  const wsRef = useRef(null)

  useEffect(() => {
    let stopped = false
    let attempts = 0
    let retryTimer

    function connect() {
      const ws = new WebSocket(socketUrl(code, name))
      wsRef.current = ws

      ws.onopen = () => {
        attempts = 0
        setStatus('open')
      }
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'room_state') {
          setRoom(msg)
          setError(null)
        } else if (msg.type === 'error') {
          if (msg.fatal) {
            stopped = true
            setFatal(msg.message)
          } else {
            setError(msg.message)
          }
        }
      }
      ws.onclose = () => {
        if (stopped) {
          setStatus('closed')
          return
        }
        attempts += 1
        setStatus('reconnecting')
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** attempts, 10000))
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      wsRef.current?.close()
    }
  }, [code, name])

  const send = useCallback((msg) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  return { room, status, error, fatal, send }
}
