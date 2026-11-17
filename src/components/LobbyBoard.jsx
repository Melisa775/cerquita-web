import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate, createSpring } from 'animejs'

const GAP = 16
const MIN_COL = 300 // narrowest column before dropping one
const SPRING = createSpring({ stiffness: 140, damping: 16 })

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Masonry board for the lobby cards. Each card goes into the shortest column,
 * so there are no gaps under short cards, and it uses the whole width
 * available. Whenever the layout changes (filter, screen size, a card opening
 * its options) anime.js moves every card to its new place.
 *
 * `items`: [{ key, visible, render(collapsed, toggle) }]
 */
export default function LobbyBoard({ items }) {
  const boxRef = useRef(null)
  const nodes = useRef(new Map())
  const placed = useRef(new Map()) // key -> { x, y, visible }
  const first = useRef(true)
  const [height, setHeight] = useState(0)
  const [open, setOpen] = useState(() => new Set())
  const frame = useRef(0)

  const layout = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    const width = box.clientWidth
    const cols = Math.max(1, Math.floor((width + GAP) / (MIN_COL + GAP)))
    const colWidth = (width - GAP * (cols - 1)) / cols
    const heights = Array(cols).fill(0)
    const instant = reduceMotion()
    const entering = []

    for (const item of items) {
      const el = nodes.current.get(item.key)
      if (!el) continue
      const prev = placed.current.get(item.key)
      if (!item.visible) {
        if (prev?.visible !== false) {
          el.style.pointerEvents = 'none'
          animate(el, { opacity: 0, scale: 0.85, duration: instant ? 0 : 260, ease: 'inQuad' })
        }
        placed.current.set(item.key, { ...(prev ?? { x: 0, y: 0 }), visible: false })
        continue
      }
      el.style.width = `${colWidth}px`
      const col = heights.indexOf(Math.min(...heights))
      const x = col * (colWidth + GAP)
      const y = heights[col]
      heights[col] += el.offsetHeight + GAP
      el.style.pointerEvents = ''

      if (first.current || !prev) {
        // first appearance: cards rise into place one after another
        entering.push({ el, x, y })
      } else if (prev.x !== x || prev.y !== y || !prev.visible) {
        animate(el, {
          translateX: x,
          translateY: y,
          opacity: 1,
          scale: 1,
          duration: instant ? 0 : undefined,
          ease: instant ? 'linear' : SPRING,
        })
      }
      placed.current.set(item.key, { x, y, visible: true })
    }

    if (entering.length) {
      entering.forEach(({ el, x, y }) => {
        el.style.transform = `translateX(${x}px) translateY(${y + 40}px) scale(0.94)`
        el.style.opacity = '0'
      })
      entering.forEach(({ el, x, y }, i) =>
        animate(el, {
          translateX: x,
          translateY: [y + 40, y],
          opacity: [0, 1],
          scale: [0.94, 1],
          duration: instant ? 0 : 650,
          delay: instant ? 0 : i * 45,
          ease: 'outBack(1.4)',
        }),
      )
    }
    first.current = false
    setHeight(Math.max(0, ...heights) - GAP)
  }, [items])

  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(layout)
  }, [layout])

  useLayoutEffect(() => {
    layout()
  }, [layout, open])

  // Re-layout when the board width changes or a card changes height (fonts, options opening…)
  useEffect(() => {
    const ro = new ResizeObserver(schedule)
    if (boxRef.current) ro.observe(boxRef.current)
    nodes.current.forEach((el) => ro.observe(el))
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [schedule])

  const toggle = (key) =>
    setOpen((s) => {
      const next = new Set(s)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div ref={boxRef} className="relative" style={{ height }}>
      {items.map((item) => (
        <div
          key={item.key}
          ref={(el) => (el ? nodes.current.set(item.key, el) : nodes.current.delete(item.key))}
          className="absolute left-0 top-0"
          style={{ opacity: 0 }}
          aria-hidden={!item.visible || undefined}
          inert={!item.visible || undefined}
        >
          {item.render(!open.has(item.key), () => toggle(item.key))}
        </div>
      ))}
    </div>
  )
}
