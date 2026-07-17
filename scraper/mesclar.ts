import {
  FONTES,
  type Dados,
  type Edital,
  type Fonte,
  type StatusFonte,
} from './schema'

export type ResultadoFonte = { editais: Edital[] } | { erro: string }

// Regra central de robustez: fonte que falhou reusa os editais da execução
// anterior e é marcada ok:false — uma fonte quebrada nunca apaga dados.
export function mesclar(
  resultados: Record<Fonte, ResultadoFonte>,
  anterior: Dados | undefined,
  agora: string,
): Dados {
  const fontes = {} as Record<Fonte, StatusFonte>
  const editais: Edital[] = []

  for (const fonte of FONTES) {
    const resultado = resultados[fonte]
    if ('editais' in resultado) {
      editais.push(...resultado.editais)
      fontes[fonte] = {
        ok: true,
        quantidade: resultado.editais.length,
        atualizadoEm: agora,
      }
    } else {
      const reusados =
        anterior?.editais.filter((e) => e.fonte === fonte) ?? []
      editais.push(...reusados)
      fontes[fonte] = {
        ok: false,
        quantidade: reusados.length,
        atualizadoEm: anterior?.fontes[fonte]?.atualizadoEm ?? agora,
        erro: resultado.erro,
      }
    }
  }

  const vistos = new Set<string>()
  const unicos = editais.filter((e) => {
    if (vistos.has(e.id)) return false
    vistos.add(e.id)
    return true
  })

  unicos.sort((a, b) => {
    if (a.inscricaoFim && b.inscricaoFim)
      return a.inscricaoFim.localeCompare(b.inscricaoFim)
    if (a.inscricaoFim) return -1
    if (b.inscricaoFim) return 1
    return a.titulo.localeCompare(b.titulo)
  })

  return { atualizadoEm: agora, fontes, editais: unicos }
}
