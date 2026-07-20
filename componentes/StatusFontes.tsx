import type { Dados, Fonte } from '@/scraper/schema'

const FONTES: Fonte[] = ['finep', 'cnpq', 'fapeg', 'capes']
const NOMES_FONTES: Record<Fonte, string> = {
  finep: 'FINEP',
  cnpq: 'CNPq',
  fapeg: 'FAPEG',
  capes: 'CAPES',
}

const FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
})

export default function StatusFontes({ dados }: { dados: Dados }) {
  return (
    <footer className="mt-20 border-t border-[var(--line)] pt-6 pb-16 text-xs text-[var(--muted)]">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {FONTES.map((f) => {
          const s = dados.fontes[f]
          if (!s) return null
          return (
            <li key={f} className="numeros">
              {NOMES_FONTES[f]}{' '}
              {s.ok ? (
                `coletado ${FMT.format(new Date(s.atualizadoEm))}`
              ) : (
                <span className="text-[var(--critico)]">
                  falhou ({s.erro ?? 'motivo não registrado'}) — mostrando
                  dados de {FMT.format(new Date(s.atualizadoEm))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-4">
        Coletado dos portais oficiais de cada agência —{' '}
        <a
          href="https://github.com/PedroClho/radar-editais"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--ink)]"
        >
          código no GitHub
        </a>
        .
      </p>
    </footer>
  )
}
