import { z } from 'zod'
import { classificar } from '../classificador'
import { buscarJson } from '../http'
import type { Edital } from '../schema'
import { fimDoDiaIso, gerarId } from '../util'

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
  // às vezes vem só {"key": ""}, sem name
  temaPrincipal: z.object({ name: z.string().optional() }).nullish(),
  tema: z.string().nullish(),
  publicoAlvo: z.array(z.object({ name: z.string() })).nullish(),
})

const RespostaFinep = z.object({ items: z.array(z.unknown()) })

export function parseFinep(resposta: unknown, agora: string): Edital[] {
  const { items } = RespostaFinep.parse(resposta)
  const editais: Edital[] = []
  for (const bruto of items) {
    const item = ItemFinep.safeParse(bruto)
    if (!item.success) continue
    const dado = item.data
    // O dataset tem registros de teste; só aprovados e abertos interessam.
    if (dado.situacao?.key !== 'aberta' || dado.status?.label !== 'approved') {
      continue
    }
    const url = `https://www.finep.gov.br/e/chamada-publica/222684/${dado.id}`
    const descricao = dado.descricaoRawText?.trim() || undefined
    const extras = [
      dado.temaPrincipal?.name,
      dado.tema,
      ...(dado.publicoAlvo ?? []).map((p) => p.name),
    ]
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
      descricao: descricao?.slice(0, 400),
      inscricaoInicio: dado.vigenciaInicio ?? undefined,
      inscricaoFim: dado.vigenciaFim ? fimDoDiaIso(dado.vigenciaFim) : undefined,
      situacao: 'aberto',
      areas,
      ia,
      coletadoEm: agora,
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
