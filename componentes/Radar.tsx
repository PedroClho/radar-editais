'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Controles from '@/componentes/Controles'
import GrupoPrazo from '@/componentes/GrupoPrazo'
import StatusFontes from '@/componentes/StatusFontes'
import {
  agruparPorPrazo,
  filtrar,
  frescor,
  listarAreasDisponiveis,
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

export default function Radar({ dados }: { dados: Dados }) {
  // O primeiro render usa o timestamp da coleta, que é igual no servidor e no
  // cliente; depois do mount corrige para o agora real.
  const [agoraMs, setAgoraMs] = useState(() =>
    new Date(dados.atualizadoEm).getTime(),
  )
  const [busca, setBusca] = useState('')
  const [fonte, setFonte] = useState<Fonte | null>(null)
  const [areas, setAreas] = useState<string[]>([])
  const [novoDesde, setNovoDesde] = useState<string | null>(null)
  // Evita que o efeito de sincronizar a URL rode antes de a URL inicial ter
  // sido lida — apagaria os parâmetros de um link compartilhado.
  const prontoRef = useRef(false)

  useEffect(() => {
    // Só no cliente existem o "agora" real, o localStorage e a URL. Ler
    // qualquer um deles durante o render quebraria a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgoraMs(Date.now())
    setNovoDesde(registrarVisita(new Date().toISOString()))

    // Um link compartilhado ("olha os editais de IA desta semana") manda
    // sobre a preferência salva; sem parâmetros, vale o localStorage.
    const params = new URLSearchParams(window.location.search)
    const fonteUrl = params.get('fonte')
    const areasUrl = params.get('areas')
    setBusca(params.get('q') ?? '')
    setFonte(
      fonteUrl && (FONTES as readonly string[]).includes(fonteUrl)
        ? (fonteUrl as Fonte)
        : null,
    )
    setAreas(
      areasUrl !== null
        ? areasUrl.split(',').filter((a) => AREAS_VALIDAS.includes(a))
        : lerAreas(AREAS_VALIDAS),
    )
    prontoRef.current = true
  }, [])

  // Filtro vira URL compartilhável — replace, sem poluir o histórico.
  useEffect(() => {
    if (!prontoRef.current) return
    const params = new URLSearchParams()
    if (busca.trim()) params.set('q', busca.trim())
    if (fonte) params.set('fonte', fonte)
    if (areas.length > 0) params.set('areas', areas.join(','))
    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      query ? `?${query}` : window.location.pathname,
    )
  }, [busca, fonte, areas])

  function mudarAreas(novas: string[]) {
    comTransicao(() => setAreas(novas))
    salvarAreas(novas)
  }

  function mudarFonte(nova: Fonte | null) {
    comTransicao(() => setFonte(nova))
  }

  const vigentes = useMemo(() => {
    const g = agruparPorPrazo(dados.editais, agoraMs)
    return [...g.estaSemana, ...g.proximasSemanas, ...g.maisAdiante, ...g.semPrazo]
  }, [dados.editais, agoraMs])

  const areasDisponiveis = useMemo(
    () => listarAreasDisponiveis(vigentes),
    [vigentes],
  )

  const visiveis = useMemo(
    () => filtrar(vigentes, { busca, fonte, areas }),
    [vigentes, busca, fonte, areas],
  )

  const grupos = useMemo(
    () => agruparPorPrazo(visiveis, agoraMs),
    [visiveis, agoraMs],
  )

  const fechamEm7 = grupos.estaSemana.length
  const temFiltro = areas.length > 0 || fonte !== null || busca.trim() !== ''
  const atualizacao = frescor(dados.atualizadoEm, agoraMs)

  function limpar() {
    comTransicao(() => {
      setBusca('')
      setFonte(null)
      setAreas([])
    })
    salvarAreas([])
  }

  return (
    <div className="mx-auto max-w-2xl px-5 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-10 sm:pt-14">
        <h1 className="serif text-xl font-medium">Radar de Editais</h1>
        <p className="numeros text-sm text-[var(--muted)]">
          {vigentes.length} {vigentes.length === 1 ? 'aberto' : 'abertos'}
          {fechamEm7 > 0 && (
            <>
              {' · '}
              <span className="text-[var(--accent-forte)]">
                {fechamEm7} {fechamEm7 === 1 ? 'fecha' : 'fecham'} em 7 dias
              </span>
            </>
          )}
          {' · '}
          <span
            className={atualizacao.velho ? 'text-[var(--critico)]' : undefined}
          >
            {atualizacao.texto}
          </span>
        </p>
      </header>

      <Controles
        busca={busca}
        fonte={fonte}
        areas={areas}
        areasDisponiveis={areasDisponiveis}
        onBusca={setBusca}
        onFonte={mudarFonte}
        onAreas={mudarAreas}
      />

      {temFiltro && visiveis.length > 0 && (
        <p className="numeros mt-3 text-xs text-[var(--muted)]">
          mostrando {visiveis.length} de {vigentes.length} ·{' '}
          <button type="button" onClick={limpar} className="underline">
            ver todos
          </button>
        </p>
      )}

      <main>
        <GrupoPrazo
          titulo="Esta semana"
          editais={grupos.estaSemana}
          agoraMs={agoraMs}
          novoDesde={novoDesde}
          vazio={temFiltro ? undefined : 'nenhum prazo fecha esta semana'}
        />
        <GrupoPrazo
          titulo="Próximas semanas"
          editais={grupos.proximasSemanas}
          agoraMs={agoraMs}
          novoDesde={novoDesde}
        />
        <GrupoPrazo
          titulo="Mais adiante"
          editais={grupos.maisAdiante}
          agoraMs={agoraMs}
          novoDesde={novoDesde}
        />
        <GrupoPrazo
          titulo="Sem prazo divulgado"
          editais={grupos.semPrazo}
          agoraMs={agoraMs}
          novoDesde={novoDesde}
          comEspinha={false}
        />

        {visiveis.length === 0 && (
          <div className="mt-20 text-center text-[var(--muted)]">
            <p>Nenhum edital com esses filtros.</p>
            <button type="button" onClick={limpar} className="mt-2 underline">
              Limpar filtros
            </button>
          </div>
        )}
      </main>

      <StatusFontes dados={dados} />
    </div>
  )
}
