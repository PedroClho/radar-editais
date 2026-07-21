import * as cheerio from 'cheerio'
import { classificar } from '../classificador'
import { buscarTexto } from '../http'
import type { Edital } from '../schema'
import { cortarEmPalavra, dataBrParaIso, gerarId } from '../util'

// Portal novo (Plone, server-rendered). O antigo memoria2.cnpq.br está
// instável (connection reset) — não usar.
export const URL_CNPQ =
  'https://www.gov.br/cnpq/pt-br/chamadas/abertas-para-submissao'

const RE_INSCRICOES =
  /Inscri[çc][õo]es:?\s*(\d{2}\/\d{2}\/\d{2,4})\s*a\s*(\d{2}\/\d{2}\/\d{2,4})/i

export function parseCnpq(html: string, agora: string): Edital[] {
  const $ = cheerio.load(html)
  const agoraMs = new Date(agora).getTime()
  const editais: Edital[] = []
  $('.item').each((_, el) => {
    const ancora = $(el).find('h2.headline a.summary.url').first()
    const titulo = ancora.text().trim()
    const url = ancora.attr('href')
    if (!titulo || !url) return
    const texto = $(el).text().replace(/\u00a0/g, ' ')
    const datas = texto.match(RE_INSCRICOES)
    const inscricaoInicio = datas ? dataBrParaIso(datas[1]) : undefined
    const inscricaoFim = datas
      ? dataBrParaIso(datas[2], { fimDoDia: true })
      : undefined
    const { areas, ia } = classificar(titulo)
    editais.push({
      id: gerarId('cnpq', url),
      fonte: 'cnpq',
      titulo,
      url,
      inscricaoInicio,
      inscricaoFim,
      situacao:
        inscricaoFim && new Date(inscricaoFim).getTime() < agoraMs
          ? 'encerrado'
          : 'aberto',
      areas,
      ia,
      coletadoEm: agora,
    })
  })
  return editais
}

// A listagem não traz resumo nenhum (só título e botões de compartilhar);
// a página individual traz o texto de abertura da chamada em #content-core.
export function parseCnpqDetalhe(html: string): string | undefined {
  const $ = cheerio.load(html)
  const paragrafos = $('#content-core p')
    .map((_, p) => $(p).text().replace(/\s+/g, ' ').trim())
    .get()
  const primeiro = paragrafos.find((p) => p.length >= 80)
  const texto = primeiro ?? $('#content-core').text().replace(/\s+/g, ' ').trim()
  return texto ? cortarEmPalavra(texto, 600) : undefined
}

export async function coletarCnpq(): Promise<Edital[]> {
  const html = await buscarTexto(URL_CNPQ, {
    // gov.br serve página de manutenção com HTTP 200 de vez em quando
    validar: (corpo) => corpo.includes('Abertas para Submissão'),
  })
  const editais = parseCnpq(html, new Date().toISOString())
  if (editais.length === 0) {
    throw new Error('CNPq retornou 0 editais abertos — layout mudou?')
  }
  // Enriquecimento por página individual (~10 requisições/dia): descrição
  // para exibir/buscar e reclassificação com texto de verdade — só pelo
  // título, metade do CNPq caía em "geral". Falha em uma página não derruba
  // a fonte: o edital segue apenas sem descrição.
  for (const edital of editais) {
    try {
      const detalhe = await buscarTexto(edital.url, {
        validar: (corpo) => corpo.includes('content-core'),
      })
      const descricao = parseCnpqDetalhe(detalhe)
      if (descricao) {
        edital.descricao = descricao
        const { areas, ia } = classificar(`${edital.titulo} ${descricao}`)
        edital.areas = areas
        edital.ia = ia
      }
    } catch {
      // segue sem descrição
    }
  }
  return editais
}
