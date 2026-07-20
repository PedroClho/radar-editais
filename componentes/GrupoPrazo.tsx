import type { Edital } from '@/scraper/schema'
import LinhaEdital from './LinhaEdital'

export default function GrupoPrazo({
  titulo,
  editais,
  agoraMs,
}: {
  titulo: string
  editais: Edital[]
  agoraMs: number
}) {
  if (editais.length === 0) return null
  return (
    <section className="mt-12 first:mt-8">
      <h2 className="flex items-baseline gap-3 text-xs tracking-wider text-[var(--muted)] uppercase">
        {titulo}
        <span className="numeros text-[var(--line)]">{editais.length}</span>
      </h2>
      <ul className="mt-3 border-t border-[var(--line)]">
        {editais.map((e) => (
          <LinhaEdital key={e.id} edital={e} agoraMs={agoraMs} />
        ))}
      </ul>
    </section>
  )
}
