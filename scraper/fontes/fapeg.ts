import * as cheerio from 'cheerio'
import { classificar } from '../classificador'
import { buscarTexto } from '../http'
import type { Edital } from '../schema'
import { gerarId } from '../util'

// Tabela curada de "Inscrições Abertas" (colunas Nº | Tipo | Origem |
// Descrição | Link). Sempre usar goias.gov.br/fapeg — o domínio antigo sem
// www dá timeout. A tabela não traz prazos (ficam nos PDFs dos editais).
export const URL_FAPEG = 'https://goias.gov.br/fapeg/editais/inscricoes-abertas/'

export function parseFapeg(html: string, agora: string): Edital[] {
  const $ = cheerio.load(html)
  const editais: Edital[] = []
  $('table.planilhaview tbody tr').each((_, tr) => {
    const celulas = $(tr).find('td')
    if (celulas.length < 5) return
    const numero = $(celulas[0]).text().trim()
    const tipo = $(celulas[1]).text().trim()
    const origem = $(celulas[2]).text().trim()
    const descricao = $(celulas[3]).text().trim()
    const url = $(celulas[4]).find('a').attr('href')
    if (!descricao || !url) return
    const titulo = `${tipo} nº ${numero} — ${descricao}`
    const { areas, ia } = classificar(`${titulo} ${origem}`)
    editais.push({
      id: gerarId('fapeg', url),
      fonte: 'fapeg',
      titulo,
      url,
      descricao: origem ? `Origem: ${origem}` : undefined,
      situacao: 'aberto',
      areas,
      ia,
      coletadoEm: agora,
    })
  })
  return editais
}

export async function coletarFapeg(): Promise<Edital[]> {
  const html = await buscarTexto(URL_FAPEG, {
    validar: (corpo) => corpo.includes('planilhaview'),
  })
  const editais = parseFapeg(html, new Date().toISOString())
  if (editais.length === 0) {
    throw new Error('FAPEG retornou 0 editais abertos — layout mudou?')
  }
  return editais
}
