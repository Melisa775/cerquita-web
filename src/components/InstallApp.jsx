import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { spring } from '../lib/motion'

/** Already opened as an installed app? */
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * "Install Cerquita" button. Android and desktop Chrome offer a real install
 * prompt; iPhone's Safari doesn't, so there it shows the two taps to do by
 * hand. Hidden when Cerquita is already open as an installed app.
 */
export default function InstallApp({ className = '' }) {
  const [prompt, setPrompt] = useState(null)
  const [help, setHelp] = useState(false)
  const [installed, setInstalled] = useState(standalone)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault() // we show our own button instead of the browser's banner
      setPrompt(e)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || (!prompt && !isIOS())) return null

  const install = async () => {
    if (!prompt) return setHelp(true)
    prompt.prompt()
    const { outcome } = await prompt.userChoice.catch(() => ({}))
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  return (
    <>
      <button onClick={install} className={`flex items-center gap-2 rounded-2xl border border-line bg-paper px-4 py-3 font-semibold hover:border-ink ${className}`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="6" y="2" width="12" height="20" rx="3" />
          <path d="M12 7v7m-3-3 3 3 3-3M10 18h4" />
        </svg>
        Instalar Cerquita en tu celular
      </button>
      <AnimatePresence>
        {help && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setHelp(false)}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Cómo instalar Cerquita"
              className="w-full max-w-sm rounded-3xl bg-paper p-6 shadow-2xl"
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 40, opacity: 0 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold">Instálala en tu iPhone</h2>
              <ol className="mt-4 space-y-3">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">1</span>
                  <span>
                    Abre esta página en <b>Safari</b> y toca el botón <b>Compartir</b>
                    <svg viewBox="0 0 24 24" className="mx-1 inline h-5 w-5 align-[-4px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="(el cuadrito con la flecha hacia arriba)">
                      <path d="M12 3v12m-4-8 4-4 4 4" />
                      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
                    </svg>
                    (abajo o arriba de la pantalla).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">2</span>
                  <span>Baja y elige <b>Agregar a inicio</b>. Listo: Cerquita queda con su ícono, como una app.</span>
                </li>
              </ol>
              <button onClick={() => setHelp(false)} className="mt-6 w-full rounded-2xl bg-ink px-4 py-3 font-semibold text-white">Entendido</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
