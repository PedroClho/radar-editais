import { CalendarPlus } from 'lucide-react'
import {
  diasAte,
  janelaInscricao,
  limparTitulo,
  NOMES_FONTES,
  nivelUrgencia,
  normalizarCaixa,
  resumir,
  separarOrigem,
  tirarPrefixoDeTitulo,
} from '@/lib/editais'
import { urlIcs } from '@/lib/ics'
import { ROTULOS } from '@/scraper/classificador'
import type { Edital } from '@/scraper/schema'

const FUSO = 'America/Sao_Paulo'

// pt-BR devolve "29 de jul." para day+month juntos, e o "de" só ocupa espaço
// numa linha já apertada. Formatamos as partes em separado para ter "29 jul".
const FMT_DIA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit' })
const FMT_MES = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, month: 'short' })

function diaMes(iso: string): string {
  const d = new Date(iso)
  return `${FMT_DIA.format(d)} ${FMT_MES.format(d).replace('.', '')}`
}

const COR_NUMERO = {
  critico: 'text-[var(--critico)]',
  proximo: 'text-[var(--accent-forte)]',
  neutro: 'text-[var(--ink)]',
} as const

const COR_BARRA = {
  critico: 'bg-[var(--critico)]',
  proximo: 'bg-[var(--accent)]',
  neutro: 'bg-[var(--accent)]',
} as const

export default function CartaoEdital({
  edital,
  agoraMs,
  novoDesde,
}: {
  edital: Edital
  agoraMs: number
  novoDesde: string | null
}) {
  const dias = edital.inscricaoFim ? diasAte(edital.inscricaoFim, agoraMs) : null
  const urgencia = nivelUrgencia(dias)
  const janela = janelaInscricao(edital, agoraMs)
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

  const etiquetas = [
    ...areas.map((a) => ROTULOS[a] ?? a),
    ...(edital.publicoAlvo?.length ? [`para ${edital.publicoAlvo.join(', ')}`] : []),
    ...(origemEnxuta ? [origemEnxuta] : []),
  ]

  return (
    <article className="relative flex flex-col gap-[9px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-[15px] pt-3.5 pb-3 transition-colors duration-150 hover:border-[var(--muted)] focus-within:border-[var(--accent)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--muted)]">
            {novo && <span className="text-[var(--accent-forte)]">novo</span>}
            <span>{NOMES_FONTES[edital.fonte]}</span>
            {edital.ia && <span className="text-[var(--accent-forte)]">IA</span>}
            {refEnxuta && (
              <span className="numeros normal-case tracking-normal">
                {refEnxuta}
              </span>
            )}
          </p>
          <h3 className="mt-[5px] line-clamp-3 text-[14.5px] leading-[1.3] font-medium text-pretty">
            <a
              href={edital.url}
              target="_blank"
              rel="noopener noreferrer"
              className="decoration-[var(--line)] underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
            >
              {normalizarCaixa(titulo)}
            </a>
          </h3>
        </div>

        <p className="flex-none text-right leading-none">
          {dias === null ? (
            <>
              <span className="numeros block text-[19px] font-medium text-[var(--muted)]">
                {edital.fluxoContinuo ? '∞' : '—'}
              </span>
              <span className="mt-[3px] block text-[10px] tracking-[0.06em] text-[var(--muted)] uppercase">
                {edital.fluxoContinuo ? 'contínuo' : 'no edital'}
              </span>
            </>
          ) : (
            <>
              <span
                className={`numeros block text-[30px] font-semibold tracking-[-0.03em] ${COR_NUMERO[urgencia]}`}
              >
                {dias}
              </span>
              <span className="mt-[3px] block text-[10px] tracking-[0.06em] text-[var(--muted)] uppercase">
                {dias === 1 ? 'dia' : 'dias'}
              </span>
            </>
          )}
        </p>
      </div>

      {descricao && (
        <p className="line-clamp-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
          {normalizarCaixa(resumir(descricao), 'frase')}
        </p>
      )}

      {/* A janela de inscrição: o período inteiro, com a fatia que ainda resta
          pintada. Só aparece quando a fonte publica as duas pontas — barra
          cheia sem início conhecido seria invenção. */}
      <div className="mt-auto">
        {janela && edital.inscricaoInicio && edital.inscricaoFim ? (
          <>
            <div
              className="flex h-[3px] overflow-hidden rounded-sm bg-[var(--line)]"
              role="img"
              aria-label={`${Math.round(janela.pctRestante * 100)}% do período de inscrição ainda restante`}
            >
              <span
                className={`rounded-sm ${COR_BARRA[urgencia]}`}
                style={{ width: `${(janela.pctRestante * 100).toFixed(1)}%` }}
              />
            </div>
            <p className="numeros mt-[5px] flex flex-wrap justify-between gap-x-2 text-[10.5px] text-[var(--muted)]">
              <span>{diaMes(edital.inscricaoInicio)}</span>
              <span>{Math.round(janela.pctRestante * 100)}% da janela restante</span>
              <span>{diaMes(edital.inscricaoFim)}</span>
            </p>
          </>
        ) : (
          <p className="numeros text-[10.5px] text-[var(--muted)]">
            {edital.inscricaoFim
              ? `fecha ${diaMes(edital.inscricaoFim)}`
              : 'janela não divulgada'}
          </p>
        )}
      </div>

      <div className="flex items-center gap-x-1.5 gap-y-1">
        <p className="flex min-w-0 flex-wrap gap-1.5 text-[11px] text-[var(--muted)]">
          {etiquetas.map((t) => (
            <span
              key={t}
              className="rounded-sm border border-[var(--line)] px-[5px] py-px"
            >
              {t}
            </span>
          ))}
        </p>
        {agendaHref && (
          <a
            href={agendaHref}
            download={`prazo-${edital.id}.ics`}
            aria-label={`Adicionar prazo de "${normalizarCaixa(titulo)}" à agenda`}
            title="Adicionar prazo à agenda"
            className="relative z-10 -m-1.5 ml-auto shrink-0 p-1.5 text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)]"
          >
            <CalendarPlus size={15} aria-hidden />
          </a>
        )}
      </div>
    </article>
  )
}
