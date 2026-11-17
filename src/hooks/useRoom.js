import { useCallback, useEffect, useRef, useState } from 'react'
import { socketUrl } from '../lib/api'

/**
 * Real-time connection to a room.
 * The server sends a full state snapshot on every change; this only keeps
 * the latest one and reconnects if the connection drops.
 */
export function useRoom(code, name) {
  const [room, setRoom] = useState(null)
  const [status, setStatus] = useState('connecting') // connecting | open | reconnecting | closed
  const [error, setError] = useState(null)
  const [errorId, setErrorId] = useState(0) // changes with every error, even if the text repeats
  const [fatal, setFatal] = useState(null)
  const wsRef = useRef(null)
  const listeners = useRef(new Set()) // small game events (e.g. strokes)

  useEffect(() => {
    let stopped = false
    let attempts = 0
    let takenRetries = 0 // see name_taken below
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
        } else if (msg.type === 'game_event') {
          listeners.current.forEach((fn) => fn(msg.event))
        } else if (msg.type === 'error') {
          if (msg.fatal && msg.code === 'name_taken' && takenRetries < 5) {
            // Usually our own previous connection (a reload, or React mounting twice in
            // development) that the server hasn't dropped yet: try again in a moment
            takenRetries += 1
            attempts = 0
          } else if (msg.fatal) {
            stopped = true
            setFatal(msg.message)
          } else {
            setError(msg.message)
            setErrorId((n) => n + 1)
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
        const delay = takenRetries && attempts === 1 ? 600 : Math.min(1000 * 2 ** attempts, 10000)
        retryTimer = setTimeout(connect, delay)
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

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn)
    return () => listeners.current.delete(fn)
  }, [])

  return { room, status, error, errorId, fatal, send, subscribe }
}
