import * as cheerio from 'cheerio'
import { classificar } from '../classificador'
import { buscarTexto } from '../http'
import type { Edital } from '../schema'
import { gerarId } from '../util'

// Página Plone tipo "Document": lista curada de links para PDFs, sem datas
// nem RSS. Prazos só dentro dos PDFs (fora do MVP) — exibimos "ver edital".
export const URL_CAPES =
  'https://www.gov.br/capes/pt-br/assuntos/editais-e-resultados-capes'

export function parseCapes(html: string, agora: string): Edital[] {
  const $ = cheerio.load(html)
  const vistos = new Set<string>()
  const editais: Edital[] = []
  $('a[href*="/centrais-de-conteudo/editais/"]').each((_, el) => {
    const titulo = $(el).text().replace(/\s+/g, ' ').trim()
    let url = $(el).attr('href')
    if (!titulo || !url) return
    if (url.startsWith('/')) url = `https://www.gov.br${url}`
    if (vistos.has(url)) return
    vistos.add(url)
    const { areas, ia } = classificar(titulo)
    editais.push({
      id: gerarId('capes', url),
      fonte: 'capes',
      titulo,
      url,
      situacao: 'indefinido',
      areas,
      ia,
      coletadoEm: agora,
    })
  })
  return editais
}

export async function coletarCapes(): Promise<Edital[]> {
  const html = await buscarTexto(URL_CAPES, {
    validar: (corpo) => corpo.includes('Editais e Resultados'),
  })
  const editais = parseCapes(html, new Date().toISOString())
  if (editais.length === 0) {
    throw new Error('CAPES retornou 0 editais — layout mudou?')
  }
  return editais
}
