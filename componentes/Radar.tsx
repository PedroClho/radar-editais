'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import BarraLateral, { Cabecalho } from '@/componentes/BarraLateral'
import CartaoEdital from '@/componentes/CartaoEdital'
import StatusFontes from '@/componentes/StatusFontes'
import {
  agruparPorPrazo,
  contarFacetas,
  diasAte,
  FAIXAS_PRAZO,
  filtrar,
  frescor,
  listarAreasDisponiveis,
  mesmoDiaSp,
  ordenarEditais,
  type FaixaPrazo,
  type Ordem,
} from '@/lib/editais'
import { lerAreas, registrarVisita, salvarAreas } from '@/lib/preferencias'
import { ROTULOS } from '@/scraper/classificador'
import { FONTES, type Dados, type Fonte } from '@/scraper/schema'

// Troca de filtro anima com a View Transitions API quando ela existe e o
// usuário não pediu menos movimento — zero dependência, degrada para troca
// instantânea. A busca fica de fora: transição a cada tecla atrapalharia.
function comTransicao(mudar: () => void) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown
  }
  if (
    typeof doc.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    doc.startViewTransition(() => flushSync(mudar))
  } else {
    mudar()
  }
}

const AREAS_VALIDAS = Object.keys(ROTULOS).filter((a) => a !== 'geral')
const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: 'prazo', rotulo: 'Prazo' },
  { id: 'janela', rotulo: 'Janela' },
]

function lerLista(bruto: string | null, validos: readonly string[]): string[] {
  if (!bruto) return []
  return bruto.split(',').filter((v) => validos.includes(v))
}

export default function Radar({ dados }: { dados: Dados }) {
  // O primeiro render usa o timestamp da coleta, que é igual no servidor e no
  // cliente; depois do mount corrige para o agora real.
  const [agoraMs, setAgoraMs] = useState(() =>
    new Date(dados.atualizadoEm).getTime(),
  )
  const [busca, setBusca] = useState('')
  const [fontes, setFontes] = useState<Fonte[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [prazo, setPrazo] = useState<FaixaPrazo | null>(null)
  const [ordem, setOrdem] = useState<Ordem>('prazo')
  const [novoDesde, setNovoDesde] = useState<string | null>(null)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  // Evita que o efeito de sincronizar a URL rode antes de a URL inicial ter
  // sido lida — apagaria os parâmetros de um link compartilhado.
  const prontoRef = useRef(false)

  useEffect(() => {
    // Só no cliente existem o "agora" real, o localStorage e a URL. Ler
    // qualquer um deles durante o render quebraria a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgoraMs(Date.now())
    setNovoDesde(registrarVisita(new Date().toISOString(), mesmoDiaSp))

    // Um link compartilhado ("olha os editais de IA desta semana") manda
    // sobre a preferência salva; sem parâmetros, vale o localStorage.
    const params = new URLSearchParams(window.location.search)
    const areasUrl = params.get('areas')
    setBusca(params.get('q') ?? '')
    // `fonte=finep` (uma só) continua válido: links compartilhados antes da
    // barra lateral multisseleção não podem quebrar.
    setFontes(lerLista(params.get('fonte'), FONTES) as Fonte[])
    setAreas(
      areasUrl !== null
        ? lerLista(areasUrl, AREAS_VALIDAS)
        : lerAreas(AREAS_VALIDAS),
    )
    const prazoUrl = params.get('prazo')
    setPrazo(
      FAIXAS_PRAZO.some((f) => f.id === prazoUrl)
        ? (prazoUrl as FaixaPrazo)
        : null,
    )
    setOrdem(params.get('ordem') === 'janela' ? 'janela' : 'prazo')
    prontoRef.current = true
  }, [])

  // Filtro vira URL compartilhável — replace, sem poluir o histórico. Com
  // debounce e try/catch: o Safari limita chamadas de replaceState por
  // janela de tempo e LANÇA quando excede — digitação rápida não pode
  // derrubar a página.
  useEffect(() => {
    if (!prontoRef.current) return
    const t = setTimeout(() => {
      const params = new URLSearchParams()
      if (busca.trim()) params.set('q', busca.trim())
      if (fontes.length > 0) params.set('fonte', fontes.join(','))
      if (areas.length > 0) params.set('areas', areas.join(','))
      if (prazo) params.set('prazo', prazo)
      if (ordem !== 'prazo') params.set('ordem', ordem)
      const query = params.toString()
      try {
        window.history.replaceState(
          null,
          '',
          query ? `?${query}` : window.location.pathname,
        )
      } catch {
        // rate limit do navegador: a URL atualiza na próxima mudança
      }
    }, 300)
    return () => clearTimeout(t)
  }, [busca, fontes, areas, prazo, ordem])

  function mudarAreas(novas: string[]) {
    comTransicao(() => setAreas(novas))
    salvarAreas(novas)
  }

  const vigentes = useMemo(() => {
    const g = agruparPorPrazo(dados.editais, agoraMs)
    return [
      ...g.estaSemana,
      ...g.proximasSemanas,
      ...g.maisAdiante,
      ...g.semPrazo,
    ]
  }, [dados.editais, agoraMs])

  const areasDisponiveis = useMemo(
    () => listarAreasDisponiveis(vigentes),
    [vigentes],
  )

  const filtros = useMemo(
    () => ({ busca, fontes, areas, prazo }),
    [busca, fontes, areas, prazo],
  )

  const visiveis = useMemo(
    () => ordenarEditais(filtrar(vigentes, filtros, agoraMs), ordem, agoraMs),
    [vigentes, filtros, ordem, agoraMs],
  )

  const facetas = useMemo(
    () => contarFacetas(vigentes, filtros, agoraMs),
    [vigentes, filtros, agoraMs],
  )

  const urgentes = useMemo(
    () =>
      vigentes.filter(
        (e) => e.inscricaoFim && diasAte(e.inscricaoFim, agoraMs) <= 7,
      ).length,
    [vigentes, agoraMs],
  )

  const temFiltro =
    areas.length > 0 || fontes.length > 0 || prazo !== null || busca.trim() !== ''

  function limpar() {
    comTransicao(() => {
      setBusca('')
      setFontes([])
      setAreas([])
      setPrazo(null)
    })
    salvarAreas([])
  }

  const resumo = {
    total: vigentes.length,
    urgentes,
    atualizacao: frescor(dados.atualizadoEm, agoraMs),
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[264px_minmax(0,1fr)]">
      <BarraLateral
        aberta={filtrosAbertos}
        onFechar={() => setFiltrosAbertos(false)}
        facetas={facetas}
        filtros={{ fontes, areas, prazo }}
        areasDisponiveis={areasDisponiveis}
        resumo={resumo}
        temFiltro={temFiltro}
        onFontes={(v) => comTransicao(() => setFontes(v))}
        onAreas={mudarAreas}
        onPrazo={(v) => comTransicao(() => setPrazo(v))}
        onLimpar={limpar}
      />

      <div className="flex min-w-0 flex-col">
        {/* Único h1 do documento, fora de qualquer bloco que o breakpoint
            possa esconder: a barra lateral some no celular e o cabeçalho
            móvel some no desktop, então nenhum dos dois pode carregá-lo. */}
        <h1 className="sr-only">Radar de Editais</h1>
        <Cabecalho
          resumo={resumo}
          className="border-b border-[var(--line)] px-4 pt-5 pb-3 sm:px-6 lg:hidden"
        />

        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-3 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            onClick={() => setFiltrosAbertos(true)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs lg:hidden"
          >
            <SlidersHorizontal size={13} aria-hidden />
            Filtros
            {temFiltro && (
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--accent)]" />
            )}
          </button>

          <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-[7px] focus-within:border-[var(--accent)]">
            <Search size={14} aria-hidden className="shrink-0 text-[var(--muted)]" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, órgão, área…"
              aria-label="Buscar edital por título ou descrição"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]"
            />
          </label>

          <div
            role="group"
            aria-label="Ordenar por"
            className="flex gap-0.5 rounded-md border border-[var(--line)] bg-[var(--surface)] p-0.5"
          >
            {ORDENS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={ordem === o.id}
                onClick={() => comTransicao(() => setOrdem(o.id))}
                className={`rounded px-2.5 py-1 text-xs transition-colors duration-150 ${
                  ordem === o.id
                    ? 'bg-[var(--bg)] font-medium text-[var(--ink)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {o.rotulo}
              </button>
            ))}
          </div>

          <p className="numeros text-xs whitespace-nowrap text-[var(--muted)]">
            {visiveis.length === vigentes.length
              ? `${vigentes.length} ${vigentes.length === 1 ? 'aberto' : 'abertos'}`
              : `${visiveis.length} de ${vigentes.length}`}
          </p>
        </div>

        <main className="px-4 pt-[18px] pb-14 sm:px-6">
          {visiveis.length === 0 ? (
            <div className="mt-20 text-center text-[var(--muted)]">
              <p>Nenhum edital com esses filtros.</p>
              <button
                type="button"
                onClick={limpar}
                className="mt-2 underline underline-offset-[3px]"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-3">
              {visiveis.map((e) => (
                <CartaoEdital
                  key={e.id}
                  edital={e}
                  agoraMs={agoraMs}
                  novoDesde={novoDesde}
                />
              ))}
            </div>
          )}
        </main>

        <div className="mt-auto px-4 sm:px-6">
          <StatusFontes dados={dados} />
        </div>
      </div>
    </div>
  )
}
