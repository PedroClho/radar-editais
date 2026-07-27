'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import {
  FAIXAS_PRAZO,
  FONTES_UI,
  NOMES_FONTES,
  type Facetas,
  type FaixaPrazo,
} from '@/lib/editais'
import { ROTULOS } from '@/scraper/classificador'
import type { Fonte } from '@/scraper/schema'

export type EstadoFiltros = {
  fontes: Fonte[]
  areas: string[]
  prazo: FaixaPrazo | null
}

type Acoes = {
  onFontes: (v: Fonte[]) => void
  onAreas: (v: string[]) => void
  onPrazo: (v: FaixaPrazo | null) => void
  onLimpar: () => void
}

export type Resumo = {
  total: number
  urgentes: number
  atualizacao: { texto: string; velho: boolean }
}

function Opcao({
  rotulo,
  quantidade,
  ativo,
  onClick,
}: {
  rotulo: string
  quantidade: number
  ativo: boolean
  onClick: () => void
}) {
  // Contagem zero continua visível — "até 7 dias 0" é resposta, não ausência —
  // mas não clicável: levaria à tela vazia com uma volta a mais para desfazer.
  const morta = quantidade === 0 && !ativo
  return (
    <button
      type="button"
      aria-pressed={ativo}
      disabled={morta}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[13px] transition-colors duration-150 ${
        ativo
          ? 'bg-[var(--bg)] font-medium text-[var(--ink)]'
          : morta
            ? 'cursor-default text-[var(--muted)] opacity-45'
            : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]'
      }`}
    >
      <span
        aria-hidden
        className={`size-[5px] shrink-0 rounded-full ${ativo ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'}`}
      />
      <span className="min-w-0 flex-1 truncate">{rotulo}</span>
      <span className="numeros shrink-0 text-[11px] text-[var(--muted)]">
        {quantidade}
      </span>
    </button>
  )
}

// Nome do site + o placar do dia. Aparece na barra fixa no desktop e num
// cabeçalho próprio no celular, onde a barra vira <dialog> e some da tela —
// sem isto, quem abre no telefone não vê em que site está.
// O <h1> não mora aqui: este bloco é renderizado mais de uma vez e qualquer
// uma das cópias pode cair em display:none dependendo da largura. O h1 fica
// sozinho, sr-only, no Radar.
export function Cabecalho({
  resumo,
  className = '',
}: {
  resumo: Resumo
  className?: string
}) {
  return (
    <div className={className}>
      <p className="serif text-[15px] font-medium">Radar de Editais</p>
      <p className="numeros mt-1 text-xs text-[var(--muted)]">
        {resumo.total} {resumo.total === 1 ? 'aberto' : 'abertos'}
        {resumo.urgentes > 0 && (
          <>
            {' · '}
            <span className="font-semibold text-[var(--accent-forte)]">
              {resumo.urgentes} {resumo.urgentes === 1 ? 'fecha' : 'fecham'} em 7
              dias
            </span>
          </>
        )}
        {' · '}
        <span
          className={resumo.atualizacao.velho ? 'text-[var(--critico)]' : undefined}
        >
          {resumo.atualizacao.texto}
        </span>
      </p>
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-[22px]">
      <h2 className="mb-2 text-[10px] font-semibold tracking-[0.09em] text-[var(--muted)] uppercase">
        {titulo}
      </h2>
      {children}
    </div>
  )
}

function Conteudo({
  facetas,
  filtros,
  areasDisponiveis,
  resumo,
  temFiltro,
  onFontes,
  onAreas,
  onPrazo,
  onLimpar,
}: {
  facetas: Facetas
  filtros: EstadoFiltros
  areasDisponiveis: string[]
  resumo: Resumo
  temFiltro: boolean
} & Acoes) {
  const alternar = <T,>(lista: T[], v: T): T[] =>
    lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]

  // Opção que zeraria a lista é beco sem saída: some, a menos que já esteja
  // marcada — aí precisa continuar visível para poder ser desmarcada.
  const visivel = (qt: number, ativo: boolean) => qt > 0 || ativo

  const fontes = FONTES_UI.filter((f) =>
    visivel(facetas.fontes[f] ?? 0, filtros.fontes.includes(f)),
  )
  const areas = areasDisponiveis.filter((a) =>
    visivel(facetas.areas[a] ?? 0, filtros.areas.includes(a)),
  )

  return (
    <>
      <Cabecalho resumo={resumo} className="mb-6" />

      {fontes.length > 0 && (
        <Grupo titulo="Órgão">
          {fontes.map((f) => (
            <Opcao
              key={f}
              rotulo={NOMES_FONTES[f]}
              quantidade={facetas.fontes[f] ?? 0}
              ativo={filtros.fontes.includes(f)}
              onClick={() => onFontes(alternar(filtros.fontes, f))}
            />
          ))}
        </Grupo>
      )}

      {areas.length > 0 && (
        <Grupo titulo="Área">
          {areas.map((a) => (
            <Opcao
              key={a}
              rotulo={ROTULOS[a] ?? a}
              quantidade={facetas.areas[a] ?? 0}
              ativo={filtros.areas.includes(a)}
              onClick={() => onAreas(alternar(filtros.areas, a))}
            />
          ))}
        </Grupo>
      )}

      <Grupo titulo="Prazo">
        {FAIXAS_PRAZO.map((faixa) => (
          <Opcao
            key={faixa.id}
            rotulo={faixa.rotulo}
            quantidade={facetas.prazos[faixa.id]}
            ativo={filtros.prazo === faixa.id}
            onClick={() => onPrazo(filtros.prazo === faixa.id ? null : faixa.id)}
          />
        ))}
      </Grupo>

      {temFiltro && (
        <button
          type="button"
          onClick={onLimpar}
          className="p-0.5 text-xs text-[var(--muted)] underline underline-offset-[3px] hover:text-[var(--ink)]"
        >
          limpar filtros
        </button>
      )}
    </>
  )
}

export default function BarraLateral({
  aberta,
  onFechar,
  ...props
}: {
  aberta: boolean
  onFechar: () => void
  facetas: Facetas
  filtros: EstadoFiltros
  areasDisponiveis: string[]
  resumo: Resumo
  temFiltro: boolean
} & Acoes) {
  const dialogo = useRef<HTMLDialogElement>(null)

  // <dialog> nativo no celular: foco preso e Esc para fechar sem escrever nada
  // disso à mão. Um aside deslocado para fora da tela continuaria tabulável.
  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (aberta && !d.open) d.showModal()
    if (!aberta && d.open) d.close()
  }, [aberta])

  return (
    <>
      <aside className="sticky top-0 hidden h-screen overflow-y-auto border-r border-[var(--line)] bg-[var(--surface)] px-5 pt-[22px] pb-10 lg:block">
        <Conteudo {...props} />
      </aside>

      <dialog
        ref={dialogo}
        onClose={onFechar}
        aria-label="Filtros"
        className="m-0 h-full max-h-none w-[min(300px,86vw)] max-w-none overflow-y-auto bg-[var(--surface)] px-5 pt-[22px] pb-10 text-[var(--ink)] backdrop:bg-black/40 lg:hidden"
      >
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar filtros"
          className="absolute top-4 right-4 p-1.5 text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <X size={16} aria-hidden />
        </button>
        <Conteudo {...props} />
      </dialog>
    </>
  )
}
