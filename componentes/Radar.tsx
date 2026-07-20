'use client'

import { useEffect, useMemo, useState } from 'react'
import Controles from '@/componentes/Controles'
import GrupoPrazo from '@/componentes/GrupoPrazo'
import LinhaEdital from '@/componentes/LinhaEdital'
import StatusFontes from '@/componentes/StatusFontes'
import { agruparPorPrazo, filtrar } from '@/lib/editais'
import { lerAreas, salvarAreas } from '@/lib/preferencias'
import type { Dados, Fonte } from '@/scraper/schema'

export default function Radar({ dados }: { dados: Dados }) {
  // O primeiro render usa o timestamp da coleta, que é igual no servidor e no
  // cliente; depois do mount corrige para o agora real.
  const [agoraMs, setAgoraMs] = useState(() =>
    new Date(dados.atualizadoEm).getTime(),
  )
  const [busca, setBusca] = useState('')
  const [fonte, setFonte] = useState<Fonte | null>(null)
  const [areas, setAreas] = useState<string[]>([])

  useEffect(() => {
    // Só no cliente existem o "agora" real e o localStorage. Ler qualquer um
    // dos dois durante o render quebraria a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgoraMs(Date.now())
    setAreas(lerAreas())
  }, [])

  function mudarAreas(novas: string[]) {
    setAreas(novas)
    salvarAreas(novas)
  }

  const vigentes = useMemo(() => {
    const g = agruparPorPrazo(dados.editais, agoraMs)
    return [...g.estaSemana, ...g.proximasSemanas, ...g.maisAdiante, ...g.semPrazo]
  }, [dados.editais, agoraMs])

  const areasDisponiveis = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const e of vigentes) {
      for (const a of e.areas) {
        if (a !== 'geral') contagem.set(a, (contagem.get(a) ?? 0) + 1)
      }
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a)
  }, [vigentes])

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

  function limpar() {
    setBusca('')
    setFonte(null)
    mudarAreas([])
  }

  return (
    <div className="mx-auto max-w-2xl px-5 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-10 sm:pt-14">
        <h1 className="serif text-xl font-medium">Radar de Editais</h1>
        <p className="numeros text-sm text-[var(--muted)]">
          {vigentes.length} abertos
          {fechamEm7 > 0 && (
            <>
              {' · '}
              <span className="text-[var(--accent-forte)]">
                {fechamEm7} {fechamEm7 === 1 ? 'fecha' : 'fecham'} em 7 dias
              </span>
            </>
          )}
        </p>
      </header>

      <Controles
        busca={busca}
        fonte={fonte}
        areas={areas}
        areasDisponiveis={areasDisponiveis}
        onBusca={setBusca}
        onFonte={setFonte}
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
        />
        <GrupoPrazo
          titulo="Próximas semanas"
          editais={grupos.proximasSemanas}
          agoraMs={agoraMs}
        />
        <GrupoPrazo
          titulo="Mais adiante"
          editais={grupos.maisAdiante}
          agoraMs={agoraMs}
        />

        {grupos.semPrazo.length > 0 && (
          <section className="mt-12">
            <h2 className="flex items-baseline gap-3 text-xs tracking-wider text-[var(--muted)] uppercase">
              Sem prazo divulgado
              <span className="numeros text-[var(--line)]">
                {grupos.semPrazo.length}
              </span>
            </h2>
            <ul className="mt-3 border-t border-[var(--line)]">
              {grupos.semPrazo.map((e) => (
                <LinhaEdital key={e.id} edital={e} agoraMs={agoraMs} />
              ))}
            </ul>
          </section>
        )}

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
