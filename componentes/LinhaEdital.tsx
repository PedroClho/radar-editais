import {
  diasAte,
  limparTitulo,
  nivelUrgencia,
  NOMES_FONTES,
  normalizarCaixa,
  resumir,
  separarOrigem,
} from '@/lib/editais'
import { ROTULOS } from '@/scraper/classificador'
import type { Edital } from '@/scraper/schema'

const FUSO = 'America/Sao_Paulo'

// pt-BR devolve "29 de jul." para day+month juntos, que quebra em três linhas
// na coluna estreita do celular. Formatamos as partes em separado para chegar
// em "29 jul".
const FMT_DIA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
})

const FMT_MES = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  month: 'short',
})

function diaMes(iso: string): string {
  const d = new Date(iso)
  return `${FMT_DIA.format(d)} ${FMT_MES.format(d).replace('.', '')}`
}

const FMT_SEMANA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'short',
})

const COR_URGENCIA = {
  critico: 'text-[var(--critico)]',
  proximo: 'text-[var(--accent-forte)]',
  neutro: 'text-[var(--ink)]',
} as const

function contagem(dias: number): string {
  if (dias === 0) return 'último dia'
  if (dias === 1) return 'falta 1 dia'
  return `faltam ${dias} dias`
}

export default function LinhaEdital({
  edital,
  agoraMs,
}: {
  edital: Edital
  agoraMs: number
}) {
  const dias = edital.inscricaoFim
    ? diasAte(edital.inscricaoFim, agoraMs)
    : null
  const urgencia = nivelUrgencia(dias)
  const { titulo, referencia } = limparTitulo(edital.titulo)
  const areas = edital.areas.filter((a) => a !== 'geral')
  // Referência e origem costumam começar repetindo o nome da fonte, que já
  // aparece ao lado ("CNPq/MinC nº 17/2026", "Origem: Fapeg/Confap/ERC").
  // Tira só o prefixo redundante e preserva os co-financiadores.
  const semFonte = (v: string) =>
    v.replace(new RegExp(`^${NOMES_FONTES[edital.fonte]}/?`, 'i'), '').trim()
  const refEnxuta = referencia && semFonte(referencia)
  const { texto: descricao, origem } = separarOrigem(edital.descricao)
  const origemEnxuta = origem && semFonte(origem)

  return (
    <li>
      <a
        href={edital.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 border-b border-[var(--line)] py-5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-6"
      >
        <div className="numeros pt-0.5 text-right">
          {edital.inscricaoFim ? (
            <>
              <span className="block text-[11px] text-[var(--muted)] lowercase">
                {FMT_SEMANA.format(new Date(edital.inscricaoFim)).replace('.', '')}
              </span>
              <span
                className={`block text-[15px] font-medium whitespace-nowrap ${COR_URGENCIA[urgencia]}`}
              >
                {diaMes(edital.inscricaoFim)}
              </span>
            </>
          ) : (
            <span aria-hidden className="block text-[15px] text-[var(--line)]">
              —
            </span>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="serif text-[17px] leading-snug text-pretty decoration-[var(--line)] underline-offset-4 group-hover:underline">
            {normalizarCaixa(titulo)}
          </h3>

          {descricao && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
              {normalizarCaixa(resumir(descricao), 'frase')}
            </p>
          )}

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
            <span>{NOMES_FONTES[edital.fonte]}</span>
            {edital.ia && (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium text-[var(--ink)]">IA</span>
              </>
            )}
            {areas.map((a) => (
              <span key={a} className="contents">
                <span aria-hidden>·</span>
                <span>{ROTULOS[a] ?? a}</span>
              </span>
            ))}
            {refEnxuta && (
              <>
                <span aria-hidden>·</span>
                <span className="numeros">{refEnxuta}</span>
              </>
            )}
            {origemEnxuta && (
              <>
                <span aria-hidden>·</span>
                <span>{origemEnxuta}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className={dias !== null ? COR_URGENCIA[urgencia] : undefined}>
              {dias === null ? 'prazo no edital' : contagem(dias)}
            </span>
          </p>
        </div>
      </a>
    </li>
  )
}
