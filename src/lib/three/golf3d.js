/**
 * Mini golf in 3D. The course (100 × 150 units, y going down the screen) is
 * built as a raised green with wooden walls, sand, water, slopes, bumpers,
 * portals and a flag. On wide screens the course lies sideways (tee on the
 * left) so it fills the stage.
 *
 * Aiming works like a slingshot: press anywhere on the stage and pull back.
 * The camera is locked while it's your turn so the drag never turns it. The
 * module reports through onPick: { kind: 'aim', angle, power } while
 * pulling, { kind: 'shoot', angle, power } on release and
 * { kind: 'shotDone', id } when a shot's animation ends.
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, canvasTexture, mat, shadowed } from './kit'
import { animate } from 'animejs'

const S = 0.06 // world units per course unit
const BALL_R = 2.2
const HOLE_R = 3.6
const PULL_MAX = 34
const toWorld = (x, y, h = 0) => new THREE.Vector3((x - 50) * S, h, (y - 75) * S)
const GREEN_Y = 0.1 // top of the green

function stripes() {
  return canvasTexture(
    64,
    64,
    (ctx) => {
      ctx.fillStyle = '#6DB94E'
      ctx.fillRect(0, 0, 64, 64)
      ctx.fillStyle = '#79C459'
      ctx.fillRect(0, 0, 64, 32)
    },
    'golf|stripes',
  )
}

function chevrons(angle) {
  const tex = canvasTexture(128, 128, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'
    ctx.lineWidth = 9
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const [x, y] of [[40, 40], [100, 40], [40, 100], [100, 100]]) {
      ctx.beginPath()
      ctx.moveTo(x - 14, y - 14)
      ctx.lineTo(x + 2, y)
      ctx.lineTo(x - 14, y + 14)
      ctx.stroke()
    }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.center.set(0.5, 0.5)
  tex.rotation = -angle
  return tex
}

function buildCourse(course) {
  const g = new THREE.Group()
  // rough around everything
  const rough = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat('#3F6E3A', { roughness: 1 }))
  rough.rotation.x = -Math.PI / 2
  rough.receiveShadow = true
  g.add(rough)

  // the green: the outline wall as a raised slab
  const shape = new THREE.Shape(course.walls[0].map(([x, y]) => new THREE.Vector2((x - 50) * S, -(y - 75) * S)))
  const slab = new THREE.ExtrudeGeometry(shape, { depth: GREEN_Y, bevelEnabled: false })
  slab.rotateX(-Math.PI / 2)
  const tex = stripes().clone()
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1 / (24 * S), 1 / (24 * S))
  tex.needsUpdate = true
  const green = new THREE.Mesh(slab, [new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), mat('#4F8A3E', { roughness: 0.9 })])
  green.receiveShadow = true
  g.add(green)

  const onTop = (y = 0.004) => GREEN_Y + y

  for (const [x, y, w, h, ax, ay] of course.slopes ?? []) {
    const t = chevrons(Math.atan2(ay, ax))
    t.repeat.set(w / 14, h / 14)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * S, h * S), new THREE.MeshStandardMaterial({ color: '#2E6B2A', map: t, transparent: true, opacity: 0.75, roughness: 1 }))
    m.rotation.x = -Math.PI / 2
    m.position.copy(toWorld(x + w / 2, y + h / 2, onTop(0.003)))
    m.userData.slope = t
    g.add(m)
  }
  for (const [x, y, w, h] of course.sand ?? []) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w * S, 0.03, h * S, 3, 0.012), mat('#EBD9A6', { roughness: 1 }))
    m.position.copy(toWorld(x + w / 2, y + h / 2, onTop(0.006)))
    m.receiveShadow = true
    g.add(m)
  }
  for (const [x, y, w, h] of course.water ?? []) {
    const wt = canvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = '#3BA3DB'
      ctx.fillRect(0, 0, 64, 64)
      ctx.strokeStyle = 'rgba(255,255,255,.5)'
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let x2 = 0; x2 <= 64; x2 += 4) ctx.lineTo(x2, 36 + Math.sin(x2 / 5) * 5)
      ctx.stroke()
    })
    wt.wrapS = wt.wrapT = THREE.RepeatWrapping
    wt.repeat.set(w / 10, h / 8)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * S, h * S), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.15, metalness: 0.1 }))
    m.rotation.x = -Math.PI / 2
    m.position.copy(toWorld(x + w / 2, y + h / 2, onTop(0.005)))
    m.userData.water = wt
    g.add(m)
  }
  for (const [ax, ay, bx, by] of course.portals ?? []) {
    const portalMat = new THREE.MeshStandardMaterial({ color: '#9B6BDB', emissive: '#7A3FD1', emissiveIntensity: 0.8 })
    const a = new THREE.Mesh(new THREE.TorusGeometry(4 * S, 0.035, 10, 36), portalMat)
    a.rotation.x = Math.PI / 2
    a.position.copy(toWorld(ax, ay, onTop(0.03)))
    a.userData.spin = 1
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(3.8 * S, 32), new THREE.MeshStandardMaterial({ color: '#3B1F66', transparent: true, opacity: 0.7 }))
    swirl.rotation.x = -Math.PI / 2
    swirl.position.copy(toWorld(ax, ay, onTop(0.008)))
    const b = new THREE.Mesh(new THREE.TorusGeometry(4 * S, 0.02, 8, 36), portalMat)
    b.rotation.x = Math.PI / 2
    b.position.copy(toWorld(bx, by, onTop(0.02)))
    b.userData.spin = -1
    g.add(a, swirl, b)
  }

  // hole, flag and tee
  const [hx, hy] = course.hole
  const lip = new THREE.Mesh(new THREE.RingGeometry(HOLE_R * S, (HOLE_R + 0.8) * S, 40), mat('#4B8A39'))
  lip.rotation.x = -Math.PI / 2
  lip.position.copy(toWorld(hx, hy, onTop(0.006)))
  const cup = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R * S, 40), mat('#141A16', { roughness: 1 }))
  cup.rotation.x = -Math.PI / 2
  cup.position.copy(toWorld(hx, hy, onTop(0.007)))
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.0, 8), mat('#F5F5F5'))
  pole.position.copy(toWorld(hx + 0.6, hy, onTop(0.5)))
  const flagGeo = new THREE.PlaneGeometry(0.42, 0.26, 8, 1)
  flagGeo.translate(0.21, 0, 0)
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: '#E8443A', side: THREE.DoubleSide }))
  flag.position.copy(toWorld(hx + 0.6, hy, onTop(0.86)))
  flag.userData.flag = Float32Array.from(flagGeo.attributes.position.array)
  const tee = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.19, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55 }))
  tee.rotation.x = -Math.PI / 2
  tee.position.copy(toWorld(course.tee[0], course.tee[1], onTop(0.006)))
  g.add(lip, cup, pole, flag, tee)

  for (const [x, y, r] of course.bumpers ?? []) {
    const b = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S * 1.05, 0.22, 28), mat('#E2486E', { roughness: 0.35 }))
    body.position.y = 0.11
    const cap = new THREE.Mesh(new THREE.TorusGeometry(r * S * 0.8, 0.02, 8, 28), mat('#FFFFFF'))
    cap.rotation.x = Math.PI / 2
    cap.position.y = 0.225
    b.add(body, cap)
    b.position.copy(toWorld(x, y, GREEN_Y))
    b.userData.bumper = [x, y, r]
    g.add(b)
  }

  // wooden walls: one beam per segment plus a post at each corner
  const wood = mat('#9A6A3E', { roughness: 0.7 })
  const woodTop = mat('#C28F5C', { roughness: 0.6 })
  const T = 2.6 * S
  for (const line of course.walls) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = toWorld(...line[i])
      const b = toWorld(...line[i + 1])
      const len = a.distanceTo(b)
      if (len < 1e-4) continue
      const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.26, T), wood)
      beam.position.set((a.x + b.x) / 2, 0.13, (a.z + b.z) / 2)
      beam.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x)
      const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, T * 0.45), woodTop)
      top.position.y = 0.135
      beam.add(top)
      g.add(beam)
    }
    for (const p of line) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(T / 2, T / 2, 0.26, 12), wood)
      post.position.copy(toWorld(...p, 0.13))
      g.add(post)
    }
  }
  return shadowed(g, true, true)
}

function makeBall(color) {
  const g = new THREE.Group()
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * S, 24, 16), mat('#FFFFFF', { roughness: 0.3 }))
  ball.castShadow = true
  const ring = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * S * 1.25, 0.012, 8, 28), new THREE.MeshBasicMaterial({ color }))
  ring.rotation.x = Math.PI / 2
  ring.position.y = -BALL_R * S + 0.01
  g.add(ball, ring)
  g.userData.ball = ball
  return g
}

function makeAim() {
  const g = new THREE.Group()
  const dots = []
  const dotGeo = new THREE.SphereGeometry(0.03, 10, 8)
  for (let i = 0; i < 14; i++) {
    const d = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: '#7CFC8A' }))
    g.add(d)
    dots.push(d)
  }
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 12), new THREE.MeshBasicMaterial({ color: '#7CFC8A' }))
  head.rotation.z = -Math.PI / 2
  const headHolder = new THREE.Group()
  headHolder.add(head)
  g.add(headHolder)
  const ring = new THREE.Mesh(new THREE.RingGeometry(BALL_R * S * 1.8, BALL_R * S * 2.1, 32), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.8, side: THREE.DoubleSide }))
  ring.rotation.x = -Math.PI / 2
  g.add(ring)
  g.visible = false
  /** Points the aim from (bx, by) toward angle with power 0..1. */
  g.userData.set = (bx, by, angle, power, color) => {
    g.visible = true
    const len = 6 + power * 34
    const c = new THREE.Color().setHSL((120 - power * 120) / 360, 0.85, 0.55)
    const ball = toWorld(bx, by, GREEN_Y + BALL_R * S)
    ring.position.copy(ball).setY(GREEN_Y + 0.01)
    ring.material.color.set(color)
    dots.forEach((d, i) => {
      const dist = 4 + i * 3.2
      d.visible = dist < len
      d.material.color.copy(c)
      d.position.copy(toWorld(bx + Math.cos(angle) * dist, by + Math.sin(angle) * dist, GREEN_Y + BALL_R * S))
    })
    head.material.color.copy(c)
    headHolder.position.copy(toWorld(bx + Math.cos(angle) * len, by + Math.sin(angle) * len, GREEN_Y + BALL_R * S))
    headHolder.rotation.y = -angle
  }
  return g
}

export function create(container, handlers) {
  let wide = false
  const stage = createStage(
    container,
    {
      background: '#CFE8D5',
      tilt: 0.9,
      portraitTilt: 0.94,
      target: [0, 0, 0],
      shadowSize: 6.5,
      layout: (aspect, world) => {
        // wide screens: the course lies sideways with the tee on the left
        wide = aspect > 1.05
        world.rotation.y = wide ? -Math.PI / 2 : 0
        return wide ? { fitHalfWidth: 4.9, fitHalfDepth: 3.6 } : { fitHalfWidth: 3.4, fitHalfDepth: 4.9 }
      },
    },
    handlers,
  )
  const { world, camera, renderer, controls } = stage
  let courseGroup = null
  let hole = null
  const balls = new Map()
  const aim = makeAim()
  world.add(aim)
  let current = null
  let seenShot = null
  let playing = null // { player, path, i, result }

  function ballPos(p, [x, y], sink = 0) {
    const b = balls.get(p)
    b.position.copy(toWorld(x, y, GREEN_Y + BALL_R * S - sink))
  }

  /* -- input: slingshot ------------------------------------------------------------ */
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GREEN_Y)
  const ray = new THREE.Raycaster()
  const v2 = new THREE.Vector2()
  function toCourse(e) {
    const r = renderer.domElement.getBoundingClientRect()
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(v2, camera)
    const hit = new THREE.Vector3()
    if (!ray.ray.intersectPlane(plane, hit)) return null
    world.worldToLocal(hit)
    return [hit.x / S + 50, hit.z / S + 75]
  }
  let drag = null
  let lastSent = 0
  const canAim = () => current?.canShoot && !playing
  const aimFrom = (e) => {
    const p = toCourse(e)
    if (!p) return null
    const dx = drag.origin[0] - p[0]
    const dy = drag.origin[1] - p[1]
    return { angle: Math.atan2(dy, dx), power: Math.min(1, Math.hypot(dx, dy) / PULL_MAX) }
  }
  const el = renderer.domElement
  const onDown = (e) => {
    if (!canAim()) return
    const origin = toCourse(e)
    if (!origin) return
    drag = { origin, aim: null }
    el.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    if (!drag) return
    const a = aimFrom(e)
    if (!a) return
    drag.aim = a
    const me = current.me
    aim.userData.set(...current.game.balls[me], a.angle, a.power, current.colors[me])
    const now = performance.now()
    if (now - lastSent > 60) {
      lastSent = now
      handlers.onPick?.({ kind: 'aim', ...a })
    }
  }
  const onUp = () => {
    if (!drag) return
    const a = drag.aim
    drag = null
    aim.visible = false
    if (a && a.power >= 0.05) handlers.onPick?.({ kind: 'shoot', ...a })
    else handlers.onPick?.({ kind: 'aim', angle: 0, power: 0 })
  }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)

  /* -- animation --------------------------------------------------------------------- */
  let acc = 0
  stage.onFrame((t, dt) => {
    // the flag waves, water flows, portals spin
    courseGroup?.traverse((o) => {
      if (o.userData.flag) {
        const pos = o.geometry.attributes.position
        const base = o.userData.flag
        for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 2] = Math.sin(t * 5 + base[i * 3] * 9) * 0.05 * (base[i * 3] / 0.42)
        pos.needsUpdate = true
      }
      if (o.userData.water) o.userData.water.offset.x = (t * 0.05) % 1
      if (o.userData.spin) o.rotation.z = t * 2 * o.userData.spin
    })
    if (!playing) return
    // the shot plays at 60 path points per second
    acc += dt * 60
    const n = Math.floor(acc)
    acc -= n
    playing.i = Math.min(playing.path.length - 1, playing.i + n)
    const [x, y] = playing.path[playing.i]
    const end = playing.i === playing.path.length - 1
    ballPos(playing.player, [x, y])
    const b = balls.get(playing.player)
    // roll the ball in the direction it moves
    if (playing.i > 0) {
      const [px, py] = playing.path[Math.max(0, playing.i - n)]
      const d = Math.hypot(x - px, y - py) * S
      if (d > 0) b.userData.ball.rotateOnWorldAxis(new THREE.Vector3(y - py, 0, -(x - px)).normalize().applyQuaternion(world.quaternion), d / (BALL_R * S))
    }
    if (end) {
      const done = playing
      playing = null
      if (done.result === 'holed' && !stage.reduce) {
        animate(b.position, { y: GREEN_Y - 0.2, duration: 350, ease: 'inQuad', onComplete: () => (b.visible = false) })
      } else if (done.result === 'water' && !stage.reduce) {
        animate(b.position, { y: GREEN_Y - 0.15, duration: 400, ease: 'inQuad' })
      }
      setTimeout(() => handlers.onPick?.({ kind: 'shotDone', id: done.id }), done.result === 'holed' || done.result === 'water' ? 420 : 0)
    }
  })

  return {
    update(state) {
      const { game, me, colors, rivalAim } = state
      if (game.hole !== hole) {
        hole = game.hole
        if (courseGroup) world.remove(courseGroup)
        courseGroup = buildCourse(game.course)
        world.add(courseGroup)
        if (!stage.reduce && current) {
          courseGroup.scale.setScalar(0.85)
          courseGroup.position.y = -0.6
          animate(courseGroup.scale, { x: 1, y: 1, z: 1, duration: 700, ease: 'outBack(1.4)' })
          animate(courseGroup.position, { y: 0, duration: 700, ease: 'outBack(1.4)' })
        }
        playing = null
        seenShot = game.lastShot?.id ?? null
      }
      for (const p of game.players) {
        if (!balls.has(p)) {
          const b = makeBall(colors[p])
          world.add(b)
          balls.set(p, b)
        }
      }
      const shot = game.lastShot
      if (shot && shot.id !== seenShot) {
        seenShot = shot.id
        playing = { ...shot, i: 0 }
        balls.get(shot.player).visible = true
        acc = 0
      }
      for (const p of game.players) {
        if (playing?.player === p) continue
        const b = balls.get(p)
        b.visible = !game.done[p]
        ballPos(p, game.balls[p])
      }
      // lock the camera while you aim, so pulling never turns it
      controls.enabled = !state.canShoot
      if (!drag) {
        if (rivalAim && rivalAim.power > 0 && game.turn && game.turn !== me && !playing) aim.userData.set(...game.balls[game.turn], rivalAim.angle, rivalAim.power, colors[game.turn])
        else aim.visible = false
      }
      current = state
    },
    get state() {
      return current
    },
    /** Course coordinates → screen (browser tests). */
    screenOf(x, y) {
      const v = world.localToWorld(toWorld(x, y, GREEN_Y)).project(camera)
      const r = el.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    },
    resetView: stage.resetView,
    zoom: stage.zoom,
    project: stage.project,
    pickableIds: stage.pickableIds,
    dispose() {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      stage.dispose()
    },
  }
}
