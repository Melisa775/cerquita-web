/** Crédito de la autora, al pie del inicio y de la sala. */
export default function Credit({ className = '' }) {
  return (
    <p className={`text-sm text-muted ${className}`}>
      Desarrollado por{' '}
      <a href="https://github.com/Melisa775" target="_blank" rel="noreferrer" className="font-semibold text-ink underline-offset-2 hover:underline">
        Melisa Gomez Gomez
      </a>
    </p>
  )
}
