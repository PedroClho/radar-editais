import { CalendarPlus } from 'lucide-react'
import {
  diasAte,
  limparTitulo,
  nivelUrgencia,
  NOMES_FONTES,
  normalizarCaixa,
  resumir,
  separarOrigem,
  tirarPrefixoDeTitulo,
} from '@/lib/editais'
import { urlIcs } from '@/lib/ics'
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

// Cor do nó na espinha — o mesmo sinal da data, codificado em posição.
const COR_NO = {
  critico: 'var(--critico)',
  proximo: 'var(--accent)',
  neutro: 'var(--line)',
} as const

function contagem(dias: number): string {
  if (dias === 0) return 'último dia'
  if (dias === 1) return 'falta 1 dia'
  return `faltam ${dias} dias`
}

export default function LinhaEdital({
  edital,
  agoraMs,
  novoDesde,
  comEspinha = true,
}: {
  edital: Edital
  agoraMs: number
  novoDesde: string | null
  comEspinha?: boolean
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
  const { texto: descBruta, origem } = separarOrigem(edital.descricao)
  // Descrição que abre repetindo o título gastaria o line-clamp em redundância.
  const descricao = descBruta && tirarPrefixoDeTitulo(descBruta, titulo)
  const origemEnxuta = origem && semFonte(origem)
  const novo = Boolean(novoDesde && edital.coletadoEm > novoDesde)
  const agendaHref = urlIcs(edital)

  return (
    <li
      className={`${comEspinha ? 'no-espinha' : ''} relative grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 border-b border-[var(--line)] py-5 transition-colors duration-150 hover:bg-[var(--surface)] sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-6`}
      style={
        comEspinha
          ? ({ '--cor-no': COR_NO[urgencia] } as React.CSSProperties)
          : undefined
      }
    >
      <div className="numeros pt-0.5 text-right">
        {edital.inscricaoFim ? (
          <>
            <span className="block text-[11px] text-[var(--muted)] lowercase">
              {FMT_SEMANA.format(new Date(edital.inscricaoFim)).replace('.', '')}
            </span>
            <span
              className={`block text-[15px] whitespace-nowrap ${
                urgencia === 'critico' ? 'font-semibold' : 'font-medium'
              } ${COR_URGENCIA[urgencia]}`}
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
        <h3 className="serif text-[17px] leading-snug text-pretty">
          <a
            href={edital.url}
            target="_blank"
            rel="noopener noreferrer"
            className="decoration-[var(--line)] underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {normalizarCaixa(titulo)}
          </a>
        </h3>

        {descricao && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
            {normalizarCaixa(resumir(descricao), 'frase')}
          </p>
        )}

        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
          {novo && (
            <>
              <span className="font-medium text-[var(--accent-forte)]">
                novo
              </span>
              <span aria-hidden>·</span>
            </>
          )}
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
          {edital.publicoAlvo && edital.publicoAlvo.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>para {edital.publicoAlvo.join(', ')}</span>
            </>
          )}
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
            {dias === null
              ? edital.fluxoContinuo
                ? 'fluxo contínuo'
                : 'prazo no edital'
              : contagem(dias)}
          </span>
          {agendaHref && (
            <a
              href={agendaHref}
              download={`prazo-${edital.id}.ics`}
              aria-label="Adicionar prazo à agenda"
              title="Adicionar prazo à agenda"
              className="relative z-10 ml-auto p-1 -m-1 text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)]"
            >
              <CalendarPlus size={15} aria-hidden />
            </a>
          )}
        </p>
      </div>
    </li>
  )
}
