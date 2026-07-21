import { normalizar } from './classificador'
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

  // `coletadoEm` significa "primeira vez que o radar viu este edital" — se o
  // id já existia, o valor antigo prevalece sobre o timestamp da execução.
  const primeiraColeta = new Map(
    anterior?.editais.map((e) => [e.id, e.coletadoEm]) ?? [],
  )

  for (const fonte of FONTES) {
    const resultado = resultados[fonte]
    if ('editais' in resultado) {
      editais.push(
        ...resultado.editais.map((e) => ({
          ...e,
          coletadoEm: primeiraColeta.get(e.id) ?? e.coletadoEm,
        })),
      )
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

  // O CMS da FINEP tem registros duplicados da mesma oportunidade em URLs
  // diferentes (ids distintos). Título+descrição idênticos na mesma fonte é
  // o mesmo edital: fica o que tem prazo (mais informação); empate, o de URL
  // menor — estável entre execuções. Sem descrição não há sinal suficiente
  // (títulos podem coincidir legitimamente) e o item nunca é deduplicado.
  const porConteudo = new Map<string, Edital>()
  const semDescricao: Edital[] = []
  for (const e of unicos) {
    if (!e.descricao) {
      semDescricao.push(e)
      continue
    }
    const chave = `${e.fonte}|${normalizar(e.titulo)}|${normalizar(e.descricao)}`
    const atual = porConteudo.get(chave)
    if (!atual) {
      porConteudo.set(chave, e)
      continue
    }
    const eMelhor =
      Boolean(e.inscricaoFim) !== Boolean(atual.inscricaoFim)
        ? Boolean(e.inscricaoFim)
        : e.url < atual.url
    if (eMelhor) porConteudo.set(chave, e)
  }

  // Prazo no passado manda sobre o que a fonte declarou: o JSON publicado é
  // fonte de verdade, nenhum consumidor deveria precisar reimplementar isso.
  const agoraMs = new Date(agora).getTime()
  const finais = [...porConteudo.values(), ...semDescricao].map((e) =>
    e.inscricaoFim
      ? {
          ...e,
          situacao:
            new Date(e.inscricaoFim).getTime() < agoraMs
              ? ('encerrado' as const)
              : ('aberto' as const),
        }
      : e,
  )

  finais.sort((a, b) => {
    if (a.inscricaoFim && b.inscricaoFim)
      return (
        new Date(a.inscricaoFim).getTime() - new Date(b.inscricaoFim).getTime()
      )
    if (a.inscricaoFim) return -1
    if (b.inscricaoFim) return 1
    return a.titulo.localeCompare(b.titulo)
  })

  return { atualizadoEm: agora, fontes, editais: finais }
}
