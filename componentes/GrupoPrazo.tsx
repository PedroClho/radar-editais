import type { Edital } from '@/scraper/schema'
import LinhaEdital from './LinhaEdital'

export default function GrupoPrazo({
  titulo,
  editais,
  agoraMs,
  novoDesde,
  comEspinha = true,
  vazio,
}: {
  titulo: string
  editais: Edital[]
  agoraMs: number
  novoDesde: string | null
  // "Sem prazo divulgado" não tem espinha: onde não há tempo, não há fio.
  comEspinha?: boolean
  // Quando presente, o grupo aparece mesmo vazio, com esta linha de estado —
  // "nada fecha esta semana" é resposta, não ausência.
  vazio?: string
}) {
  if (editais.length === 0 && !vazio) return null
  return (
    <section className="mt-12 first:mt-8">
      <h2 className="flex items-baseline gap-3">
        <span className="serif text-[15px] italic">{titulo}</span>
        {editais.length > 0 && (
          <span className="numeros text-xs text-[var(--muted)]">
            {editais.length}
          </span>
        )}
      </h2>
      {editais.length === 0 ? (
        <p className="mt-3 border-t border-[var(--line)] py-4 text-sm text-[var(--muted)]">
          {vazio}
        </p>
      ) : (
        <ul
          className={`mt-3 border-t border-[var(--line)] ${comEspinha ? 'com-espinha' : ''}`}
        >
          {editais.map((e) => (
            <LinhaEdital
              key={e.id}
              edital={e}
              agoraMs={agoraMs}
              novoDesde={novoDesde}
              comEspinha={comEspinha}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
