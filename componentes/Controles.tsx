'use client'

import { Search } from 'lucide-react'
import { FONTES_UI, NOMES_FONTES } from '@/lib/editais'
import { ROTULOS } from '@/scraper/classificador'
import type { Fonte } from '@/scraper/schema'

export default function Controles({
  busca,
  fonte,
  areas,
  areasDisponiveis,
  onBusca,
  onFonte,
  onAreas,
}: {
  busca: string
  fonte: Fonte | null
  areas: string[]
  areasDisponiveis: string[]
  onBusca: (v: string) => void
  onFonte: (v: Fonte | null) => void
  onAreas: (v: string[]) => void
}) {
  function alternar(area: string) {
    onAreas(
      areas.includes(area) ? areas.filter((a) => a !== area) : [...areas, area],
    )
  }

  return (
    // Numa página de 6.500px, filtrar sem rolar de volta ao topo é função.
    // O fundo levemente translúcido + blur mantém a leitura da lista por
    // baixo sem comprometer o contraste dos controles.
    <div className="sticky top-0 z-10 -mx-5 mt-8 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-5 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <div className="flex items-center gap-5">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <Search
            size={14}
            aria-hidden
            className="shrink-0 text-[var(--muted)]"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar edital"
            aria-label="Buscar edital por título ou descrição"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
          />
        </label>

        <label className="flex shrink-0 items-center gap-2 text-sm">
          <span className="text-xs text-[var(--muted)]">fonte</span>
          <select
            value={fonte ?? ''}
            onChange={(e) => onFonte((e.target.value || null) as Fonte | null)}
            className="bg-transparent text-sm outline-none"
          >
            <option value="">todas</option>
            {FONTES_UI.map((f) => (
              <option key={f} value={f}>
                {NOMES_FONTES[f]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
        role="group"
        aria-label="Minhas áreas"
      >
        <span className="text-xs text-[var(--muted)]">minhas áreas</span>
        {areasDisponiveis.map((a) => {
          const ativa = areas.includes(a)
          return (
            <button
              key={a}
              type="button"
              aria-pressed={ativa}
              onClick={() => alternar(a)}
              className={`-my-1 py-1 transition-colors duration-150 ${
                ativa
                  ? 'text-[var(--ink)] underline decoration-[var(--accent)] decoration-2 underline-offset-4'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {ROTULOS[a] ?? a}
            </button>
          )
        })}
      </div>
    </div>
  )
}
