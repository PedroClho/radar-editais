'use client'

import { useEffect, useMemo, useState } from 'react'
import { normalizar, ROTULOS } from '@/scraper/classificador'
import type { Dados, Edital, Fonte } from '@/scraper/schema'

const FONTES_UI: Fonte[] = ['finep', 'cnpq', 'fapeg', 'capes']
const NOMES_FONTES: Record<Fonte, string> = {
  finep: 'FINEP',
  cnpq: 'CNPq',
  fapeg: 'FAPEG',
  capes: 'CAPES',
}
const DIA_MS = 86_400_000
const URGENTE_DIAS = 14

function formatarData(
  iso: string,
  opcoes: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' },
) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...opcoes,
  }).format(new Date(iso))
}

function diasRestantes(fimIso: string, agoraMs: number): number {
  return Math.ceil((new Date(fimIso).getTime() - agoraMs) / DIA_MS)
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors ${
        ativo
          ? 'border-transparent bg-[var(--ink)] text-[var(--bg)]'
          : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
      }`}
    >
      {children}
    </button>
  )
}

function JanelaInscricao({
  edital,
  agoraMs,
}: {
  edital: Edital
  agoraMs: number
}) {
  if (!edital.inscricaoInicio || !edital.inscricaoFim) return null
  const inicio = new Date(edital.inscricaoInicio).getTime()
  const fim = new Date(edital.inscricaoFim).getTime()
  if (fim <= inicio) return null
  const pct = Math.min(1, Math.max(0, (agoraMs - inicio) / (fim - inicio)))
  return (
    <div
      aria-hidden
      className="mt-3 h-[3px] w-full max-w-70 rounded-full bg-[var(--line)]"
      title={`Inscrições de ${formatarData(edital.inscricaoInicio)} a ${formatarData(edital.inscricaoFim)}`}
    >
      <div
        className="h-full rounded-full bg-[var(--accent)]"
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  )
}

function LinhaEdital({
  edital,
  agoraMs,
  urgente,
}: {
  edital: Edital
  agoraMs: number
  urgente: boolean
}) {
  const dias = edital.inscricaoFim
    ? diasRestantes(edital.inscricaoFim, agoraMs)
    : null
  return (
    <li>
      <a
        href={edital.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group grid grid-cols-[1fr_auto] items-start gap-x-6 border-b border-[var(--line)] py-5"
      >
        <div className="min-w-0">
          <p className="dados flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-wide text-[var(--muted)] uppercase">
            <span>{NOMES_FONTES[edital.fonte]}</span>
            {edital.ia && (
              <span className="rounded-sm bg-[var(--ink)] px-1.5 py-px font-semibold text-[var(--bg)]">
                IA
              </span>
            )}
            {edital.areas
              .filter((a) => a !== 'geral')
              .map((a) => (
                <span key={a}>{ROTULOS[a] ?? a}</span>
              ))}
          </p>
          <h3 className="mt-1.5 leading-snug font-medium text-pretty group-hover:underline">
            {edital.titulo}
          </h3>
          <JanelaInscricao edital={edital} agoraMs={agoraMs} />
        </div>
        <div className="dados pt-0.5 text-right">
          {dias === null ? (
            <span className="text-xs text-[var(--muted)]">
              prazo no edital
            </span>
          ) : (
            <>
              <span
                className={`block text-2xl font-semibold ${
                  urgente ? 'text-[var(--accent-forte)]' : ''
                }`}
              >
                {dias <= 0 ? 'hoje' : dias}
              </span>
              <span className="block text-xs text-[var(--muted)]">
                {dias <= 0
                  ? 'último dia'
                  : `${dias === 1 ? 'dia' : 'dias'} · até ${formatarData(edital.inscricaoFim!)}`}
              </span>
            </>
          )}
        </div>
      </a>
    </li>
  )
}

function Secao({
  titulo,
  editais,
  agoraMs,
  urgente = false,
}: {
  titulo: string
  editais: Edital[]
  agoraMs: number
  urgente?: boolean
}) {
  if (editais.length === 0) return null
  return (
    <section className="mt-10">
      <h2
        className={`dados text-xs font-semibold tracking-widest uppercase ${
          urgente ? 'text-[var(--accent-forte)]' : 'text-[var(--muted)]'
        }`}
      >
        {titulo} · {editais.length}
      </h2>
      <ul className="mt-2 border-t border-[var(--line)]">
        {editais.map((e) => (
          <LinhaEdital
            key={e.id}
            edital={e}
            agoraMs={agoraMs}
            urgente={urgente}
          />
        ))}
      </ul>
    </section>
  )
}

export default function Dashboard({ dados }: { dados: Dados }) {
  // Primeiro render usa o timestamp da coleta (determinístico entre servidor e
  // cliente, evita erro de hidratação); depois do mount corrige para o agora real.
  const [agoraMs, setAgoraMs] = useState(() =>
    new Date(dados.atualizadoEm).getTime(),
  )
  useEffect(() => {
    setAgoraMs(Date.now())
  }, [])

  const [areaAtiva, setAreaAtiva] = useState<string | null>(null)
  const [fonteAtiva, setFonteAtiva] = useState<Fonte | null>(null)
  const [soIA, setSoIA] = useState(false)
  const [busca, setBusca] = useState('')

  const vigentes = useMemo(
    () =>
      dados.editais.filter(
        (e) =>
          e.situacao !== 'encerrado' &&
          (!e.inscricaoFim || diasRestantes(e.inscricaoFim, agoraMs) >= 0),
      ),
    [dados.editais, agoraMs],
  )

  const contagemAreas = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const e of vigentes) {
      for (const a of e.areas) mapa.set(a, (mapa.get(a) ?? 0) + 1)
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }, [vigentes])

  const totalIA = useMemo(() => vigentes.filter((e) => e.ia).length, [vigentes])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim())
    return vigentes.filter(
      (e) =>
        (!areaAtiva || e.areas.includes(areaAtiva)) &&
        (!fonteAtiva || e.fonte === fonteAtiva) &&
        (!soIA || e.ia) &&
        (!termo ||
          normalizar(`${e.titulo} ${e.descricao ?? ''}`).includes(termo)),
    )
  }, [vigentes, areaAtiva, fonteAtiva, soIA, busca])

  const urgentes = visiveis.filter(
    (e) =>
      e.inscricaoFim &&
      diasRestantes(e.inscricaoFim, agoraMs) <= URGENTE_DIAS,
  )
  const abertos = visiveis.filter(
    (e) =>
      e.inscricaoFim && diasRestantes(e.inscricaoFim, agoraMs) > URGENTE_DIAS,
  )
  const semPrazo = visiveis.filter((e) => !e.inscricaoFim)

  const temFiltro = areaAtiva || fonteAtiva || soIA || busca.trim()

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8">
      <header className="pt-12 sm:pt-16">
        <p className="dados text-xs tracking-widest text-[var(--muted)] uppercase">
          FINEP · CNPq · FAPEG · CAPES
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Radar de Editais
        </h1>
        <p className="mt-3 max-w-xl text-[var(--muted)]">
          Editais de fomento à pesquisa e inovação abertos agora, coletados
          diariamente dos portais oficiais e rotulados por área — com destaque
          para IA.
        </p>
        <p className="dados mt-4 text-xs text-[var(--muted)]">
          Atualizado em{' '}
          {formatarData(dados.atualizadoEm, {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          · {vigentes.length} editais vigentes
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por título ou descrição"
          aria-label="Buscar edital"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm placeholder:text-[var(--muted)]"
        />
        <div className="flex flex-wrap gap-2">
          <Chip ativo={soIA} onClick={() => setSoIA(!soIA)}>
            Só IA · {totalIA}
          </Chip>
          {contagemAreas.map(([area, n]) => (
            <Chip
              key={area}
              ativo={areaAtiva === area}
              onClick={() => setAreaAtiva(areaAtiva === area ? null : area)}
            >
              {ROTULOS[area] ?? area} · {n}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {FONTES_UI.map((f) => (
            <Chip
              key={f}
              ativo={fonteAtiva === f}
              onClick={() => setFonteAtiva(fonteAtiva === f ? null : f)}
            >
              {NOMES_FONTES[f]}
            </Chip>
          ))}
        </div>
      </div>

      <main>
        <Secao
          titulo="Encerram em até 14 dias"
          editais={urgentes}
          agoraMs={agoraMs}
          urgente
        />
        <Secao titulo="Inscrições abertas" editais={abertos} agoraMs={agoraMs} />
        <Secao
          titulo="Sem prazo divulgado"
          editais={semPrazo}
          agoraMs={agoraMs}
        />
        {visiveis.length === 0 && (
          <div className="mt-16 text-center text-[var(--muted)]">
            <p>Nenhum edital com esses filtros.</p>
            {temFiltro && (
              <button
                type="button"
                onClick={() => {
                  setAreaAtiva(null)
                  setFonteAtiva(null)
                  setSoIA(false)
                  setBusca('')
                }}
                className="mt-2 underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </main>

      <footer className="mt-16 border-t border-[var(--line)] pt-6 pb-12 text-sm text-[var(--muted)]">
        <ul className="dados flex flex-wrap gap-x-6 gap-y-2 text-xs">
          {FONTES_UI.map((f) => {
            const s = dados.fontes[f]
            if (!s) return null
            return (
              <li key={f}>
                {NOMES_FONTES[f]}{' '}
                {s.ok
                  ? `✓ coletado em ${formatarData(s.atualizadoEm)}`
                  : `✕ falhou — dados de ${formatarData(s.atualizadoEm)}`}
              </li>
            )
          })}
        </ul>
        <p className="mt-4">
          Dados coletados dos portais oficiais de cada agência. Projeto aberto —{' '}
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
    </div>
  )
}
