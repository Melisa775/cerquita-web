import { useEffect, useRef } from 'react'

export const CANVAS_W = 1000
export const CANVAS_H = 750

function drawStroke(ctx, stroke, scale, from = 0) {
  const pts = stroke.points
  if (!pts.length) return
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineWidth = stroke.size * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (pts.length === 1) {
    ctx.beginPath()
    ctx.arc(pts[0][0] * scale, pts[0][1] * scale, (stroke.size * scale) / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const start = Math.max(0, from - 1)
  ctx.beginPath()
  ctx.moveTo(pts[start][0] * scale, pts[start][1] * scale)
  for (let i = start + 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * scale, pts[i][1] * scale)
  ctx.stroke()
}

/**
 * Lienzo del Pinturillo. Pinta los trazos del servidor y, si `subscribe`
 * está, los eventos en vivo del otro. Si `tool` está, se puede dibujar.
 */
export default function DrawingCanvas({ strokes, subscribe, tool, onStroke, onPoints, onEnd, className = '' }) {
  const canvasRef = useRef(null)
  const local = useRef([]) // trazos que se ven ahora mismo
  const scaleRef = useRef(1)
  const drawing = useRef(null) // trazo propio en curso

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (const s of local.current) drawStroke(ctx, s, scaleRef.current)
  }

  // Tamaño real según el ancho en pantalla y la densidad de píxeles
  useEffect(() => {
    const canvas = canvasRef.current
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(w * 0.75 * dpr)
      scaleRef.current = canvas.width / CANVAS_W
      redraw()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // La foto del servidor manda (salvo mientras uno mismo está trazando)
  useEffect(() => {
    if (drawing.current) return
    local.current = strokes.map((s) => ({ ...s, points: [...s.points] }))
    redraw()
  }, [strokes])

  // Trazos en vivo de la pareja
  useEffect(() => {
    if (!subscribe) return
    return subscribe((ev) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ev.kind === 'stroke') {
        const s = { ...ev.stroke, points: [...ev.stroke.points] }
        local.current.push(s)
        if (ctx) drawStroke(ctx, s, scaleRef.current)
      } else if (ev.kind === 'points') {
        const s = [...local.current].reverse().find((x) => x.id === ev.id)
        if (!s) return
        const from = s.points.length
        s.points.push(...ev.points)
        if (ctx) drawStroke(ctx, s, scaleRef.current, from)
      } else if (ev.kind === 'undo') {
        local.current.pop()
        redraw()
      } else if (ev.kind === 'clear') {
        local.current = []
        redraw()
      }
    })
  }, [subscribe])

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return [
      Math.round(((e.clientX - rect.left) / rect.width) * CANVAS_W),
      Math.round(((e.clientY - rect.top) / rect.height) * CANVAS_H),
    ]
  }

  function down(e) {
    if (!tool) return
    e.preventDefault()
    canvasRef.current.setPointerCapture?.(e.pointerId)
    const s = { id: Math.random().toString(36).slice(2, 10), color: tool.color, size: tool.size, points: [point(e)] }
    drawing.current = s
    local.current.push(s)
    drawStroke(canvasRef.current.getContext('2d'), s, scaleRef.current)
    onStroke?.(s)
  }

  function move(e) {
    const s = drawing.current
    if (!s) return
    const p = point(e)
    const last = s.points.at(-1)
    if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 3) return
    s.points.push(p)
    drawStroke(canvasRef.current.getContext('2d'), s, scaleRef.current, s.points.length - 1)
    onPoints?.(s.id, p)
  }

  function up() {
    if (!drawing.current) return
    const id = drawing.current.id
    drawing.current = null
    onEnd?.(id)
  }

  return (
    <canvas
      ref={canvasRef}
      className={`block aspect-[4/3] w-full touch-none rounded-2xl bg-white ${tool ? 'cursor-crosshair' : ''} ${className}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    />
  )
}
