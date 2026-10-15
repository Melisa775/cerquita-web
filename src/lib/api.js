// En desarrollo VITE_API_URL queda vacío y Vite hace de proxy hacia FastAPI.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function createRoom() {
  const res = await fetch(`${API_URL}/api/rooms`, { method: 'POST' })
  if (!res.ok) throw new Error('No se pudo crear la sala. Revisa que el servidor esté encendido.')
  return (await res.json()).code
}

export async function checkRoom(code) {
  const res = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(code)}`)
  if (res.status === 404) throw new Error('Esa sala no existe. Revisa el código.')
  if (!res.ok) throw new Error('No se pudo conectar con el servidor.')
  return res.json()
}

export function socketUrl(code, name) {
  const base = API_URL || window.location.origin
  const url = new URL(`/ws/${encodeURIComponent(code)}`, base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('name', name)
  return url.toString()
}

// localStorage puede fallar (modo privado, almacenamiento bloqueado)
export const storage = {
  get(key) { try { return localStorage.getItem(key) } catch { return null } },
  set(key, value) { try { localStorage.setItem(key, value) } catch { /* sin almacenamiento */ } },
}
