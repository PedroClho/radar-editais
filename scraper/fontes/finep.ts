import { z } from 'zod'
import { classificar, normalizar } from '../classificador'
import { buscarJson } from '../http'
import type { Edital } from '../schema'
import { cortarEmPalavra, fimDoDiaIso, gerarId } from '../util'

// API JSON pública (Liferay Objects), sem autenticação. O filtro OData precisa
// ser `situacao eq 'aberta'` — a forma `situacao/key eq` retorna 400.
export const URL_API_FINEP =
  "https://www.finep.gov.br/o/c/chamadapublicas?filter=situacao%20eq%20'aberta'&pageSize=200&sort=dataDePublicacao:desc"

const ItemFinep = z.object({
  id: z.number(),
  titulo: z.string(),
  descricaoRawText: z.string().nullish(),
  situacao: z.object({ key: z.string() }).nullish(),
  status: z.object({ label: z.string() }).nullish(),
  vigenciaInicio: z.string().nullish(),
  vigenciaFim: z.string().nullish(),
  dataDePublicacao: z.string().nullish(),
  // Prazo real de envio de propostas — é o que a página do edital exibe.
  // `vigenciaFim` é a vigência do instrumento e chega a ser 3 meses mais
  // tarde; usar ela fazia o site anunciar folga que não existe.
  prazoProposto: z.string().nullish(),
  // às vezes vem só {"key": ""}, sem name
  temaPrincipal: z.object({ name: z.string().optional() }).nullish(),
  tema: z.string().nullish(),
  publicoAlvo: z.array(z.object({ name: z.string() })).nullish(),
})

const RespostaFinep = z.object({ items: z.array(z.unknown()) })

// O campo publicoAlvo mistura categorias reais com faixas de faturamento
// ("Receita: até R$ 4,8 Mi" ×5 = empresas de qualquer porte). Para exibição,
// as faixas colapsam em "empresas" e as categorias ganham forma canônica.
const PUBLICO_CANONICO: Record<string, string> = {
  Startup: 'startups',
  Cooperativa: 'cooperativas',
  ICT: 'ICTs',
  'Fundos de Investimento': 'fundos de investimento',
}

export function canonizarPublicoAlvo(nomes: string[]): string[] {
  const resultado: string[] = []
  for (const nome of nomes) {
    const canonico = nome.startsWith('Receita:')
      ? 'empresas'
      : (PUBLICO_CANONICO[nome] ?? nome.toLowerCase())
    if (!resultado.includes(canonico)) resultado.push(canonico)
  }
  return resultado
}

// A FINEP mantém registros `situacao: 'aberta'` que são lixo histórico
// (chamadas de 2015-2017 sem prazo). Sem `inscricaoFim` não há como o prazo
// mandar — o corte é por idade de publicação. 18 meses preserva qualquer
// edital recente ainda sem prazo divulgado.
const CORTE_SEM_PRAZO_MS = 548 * 86_400_000

export function parseFinep(resposta: unknown, agora: string): Edital[] {
  const { items } = RespostaFinep.parse(resposta)
  const agoraMs = new Date(agora).getTime()
  const editais: Edital[] = []
  for (const bruto of items) {
    const item = ItemFinep.safeParse(bruto)
    if (!item.success) continue
    const dado = item.data
    // O dataset tem registros de teste; só aprovados e abertos interessam.
    if (dado.situacao?.key !== 'aberta' || dado.status?.label !== 'approved') {
      continue
    }
    const prazo = dado.prazoProposto ?? dado.vigenciaFim
    const descricao = dado.descricaoRawText?.trim() || undefined
    const fluxoContinuo = normalizar(
      `${dado.titulo} ${descricao ?? ''}`,
    ).includes('fluxo continuo')
    if (!prazo && !fluxoContinuo) {
      const publicadoEm = dado.dataDePublicacao ?? dado.vigenciaInicio
      if (
        publicadoEm &&
        agoraMs - new Date(publicadoEm).getTime() > CORTE_SEM_PRAZO_MS
      ) {
        continue
      }
    }
    const url = `https://www.finep.gov.br/e/chamada-publica/222684/${dado.id}`
    const nomesPublico = (dado.publicoAlvo ?? [])
      .map((p) => p.name.trim())
      .filter(Boolean)
    const publicoAlvo = canonizarPublicoAlvo(nomesPublico)
    const extras = [dado.temaPrincipal?.name, dado.tema, ...nomesPublico]
      .filter(Boolean)
      .join(' ')
    const { areas, ia } = classificar(
      `${dado.titulo} ${descricao ?? ''} ${extras}`,
    )
    editais.push({
      id: gerarId('finep', url),
      fonte: 'finep',
      titulo: dado.titulo.trim(),
      url,
      descricao: descricao && cortarEmPalavra(descricao, 600),
      inscricaoInicio: dado.vigenciaInicio ?? undefined,
      inscricaoFim: prazo ? fimDoDiaIso(prazo) : undefined,
      situacao: 'aberto',
      areas,
      ia,
      coletadoEm: agora,
      publicoAlvo: publicoAlvo.length > 0 ? publicoAlvo : undefined,
      fluxoContinuo: fluxoContinuo || undefined,
    })
  }
  return editais
}

export async function coletarFinep(): Promise<Edital[]> {
  const resposta = await buscarJson(URL_API_FINEP)
  const editais = parseFinep(resposta, new Date().toISOString())
  if (editais.length === 0) {
    throw new Error('FINEP retornou 0 editais abertos — layout/API mudou?')
  }
  return editais
}
