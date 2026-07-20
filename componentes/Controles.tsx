'use client'

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
    <div className="mt-8 flex flex-col gap-3 border-y border-[var(--line)] py-3 sm:flex-row sm:items-center sm:gap-5">
      <input
        type="search"
        value={busca}
        onChange={(e) => onBusca(e.target.value)}
        placeholder="Buscar"
        aria-label="Buscar edital por título ou descrição"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
      />

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
        role="group"
        aria-label="Minhas áreas"
      >
        <span className="text-xs text-[var(--muted)]">áreas</span>
        {areasDisponiveis.map((a) => {
          const ativa = areas.includes(a)
          return (
            <button
              key={a}
              type="button"
              aria-pressed={ativa}
              onClick={() => alternar(a)}
              className={
                ativa
                  ? 'text-[var(--ink)] underline decoration-[var(--accent)] decoration-2 underline-offset-4'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }
            >
              {ROTULOS[a] ?? a}
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
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
  )
}
