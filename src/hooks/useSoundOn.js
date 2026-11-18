import { useEffect, useRef } from 'react'
import { play } from '../lib/sound'

/**
 * Plays `name` when `when` turns true while you're watching (not when the
 * page opens on something that already happened).
 */
export function useSoundOn(when, name) {
  const prev = useRef(when)
  useEffect(() => {
    if (when && !prev.current) play(name)
    prev.current = when
  }, [when, name])
}
