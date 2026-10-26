import Credit from '../components/Credit'
import { useState } from 'react'
import { checkRoom, createRoom, storage } from '../lib/api'

export default function Home({ initialCode = '', onEnter }) {
  const [name, setName] = useState(storage.get('cerquita:name') || '')
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(null) // 'create' | 'join'
  const [error, setError] = useState(null)

  const cleanName = name.trim()

  async function run(kind, action) {
    if (!cleanName) {
      setError('Escribe tu nombre para que tu pareja sepa quién eres.')
      return
    }
    setBusy(kind)
    setError(null)
    try {
      const roomCode = await action()
      storage.set('cerquita:name', cleanName)
      onEnter(roomCode, cleanName)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const join = (e) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c.length !== 5) {
      setError('El código tiene 5 letras.')
      return
    }
    run('join', async () => {
      const info = await checkRoom(c)
      if (info.full && !info.players.includes(cleanName)) throw new Error('Esa sala ya tiene dos personas.')
      return c
    })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-12">
      <Logo />
      <h1 className="mt-8 text-5xl leading-[0.95] font-extrabold sm:text-6xl">
        Juegos para dos, aunque estén lejos.
      </h1>
      <p className="mt-5 max-w-md text-lg text-muted">
        Abran una videollamada, entren a la misma sala y jueguen en español, sincronizados y sin pagar.
      </p>

      <label className="mt-10 block">
        <span className="text-sm font-semibold">Tu nombre</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          placeholder="Como te dice tu pareja"
          className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3.5 text-lg outline-none focus:border-ink"
        />
      </label>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-3xl bg-p1 p-5 text-white">
          <h2 className="text-xl font-bold">Crear una sala</h2>
          <p className="mt-1 text-sm text-white/80">Te damos un código para enviarle.</p>
          <button
            onClick={() => run('create', createRoom)}
            disabled={busy !== null}
            className="mt-5 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-p1 disabled:opacity-60"
          >
            {busy === 'create' ? 'Creando…' : 'Crear sala'}
          </button>
        </section>

        <form onSubmit={join} className="rounded-3xl bg-p2 p-5 text-white">
          <h2 className="text-xl font-bold">Entrar con código</h2>
          <label className="mt-1 block text-sm text-white/80" htmlFor="code">El que te envió tu pareja.</label>
          <div className="mt-5 flex gap-2">
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              maxLength={5}
              placeholder="ABCDE"
              autoCapitalize="characters"
              className="w-full min-w-0 rounded-2xl bg-white/15 px-4 py-3 font-display text-lg font-bold tracking-[0.2em] text-white placeholder:text-white/50 outline-none focus:bg-white/25"
            />
            <button
              type="submit"
              disabled={busy !== null}
              className="rounded-2xl bg-white px-4 py-3 font-semibold text-p2 disabled:opacity-60"
            >
              {busy === 'join' ? '…' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>

      {error && <p role="alert" className="mt-5 font-medium text-danger">{error}</p>}
      <Credit className="mt-12" />
    </main>
  )
}

export function Logo({ small = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={small ? 26 : 34} height={small ? 26 : 34} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="11" cy="16" r="8" fill="var(--color-p1)" />
        <circle cx="21" cy="16" r="8" fill="var(--color-p2)" fillOpacity=".9" />
      </svg>
      <span className={`font-display font-extrabold ${small ? 'text-xl' : 'text-2xl'}`}>Cerquita</span>
    </div>
  )
}
