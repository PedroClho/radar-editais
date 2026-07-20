import * as cheerio from 'cheerio'
import { PDFParse } from 'pdf-parse'
import { classificar } from '../classificador'
import { buscarTexto } from '../http'
import type { Edital } from '../schema'
import { dataBrParaIso, gerarId } from '../util'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

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

// A data de submissão da FAPEG só existe dentro do PDF, na tabela
// "CRONOGRAMA". O rótulo varia entre editais ("Limite para Submissão" ou
// "Limite para Inscrições"), e a extração de texto do PDF costuma quebrar a
// célula da tabela em várias linhas — a data às vezes só aparece 1 ou 2
// linhas abaixo do rótulo. Por isso a busca é por linha, olhando para
// frente até achar uma data, e PARA nela: se olhasse longe demais acabaria
// pegando a data da atividade seguinte da tabela (ex.: "resultado
// preliminar"). Não usamos `lastIndexOf('CRONOGRAMA')` para recortar o
// texto antes de procurar — a palavra reaparece depois no corpo do edital
// (ex.: "cronograma de desembolsos"), então a última ocorrência pode cair
// bem depois da tabela real e esconder a data verdadeira.
const RE_GATILHO = /limite\s+para\s+(?:submiss[ãa]o|inscri[çc][õo]es)/i
const RE_DATA = /\d{2}\/\d{2}\/\d{4}/g
const JANELA_MAX_LINHAS = 5

export function extrairPrazoCronograma(texto: string): string | undefined {
  const linhas = texto.split('\n')
  for (let i = 0; i < linhas.length; i++) {
    if (!RE_GATILHO.test(linhas[i])) continue
    for (let j = i; j < Math.min(i + JANELA_MAX_LINHAS, linhas.length); j++) {
      const datas = linhas[j].match(RE_DATA)
      if (!datas) continue
      const isos = datas
        .map((d) => dataBrParaIso(d, { fimDoDia: true }))
        .filter((d): d is string => Boolean(d))
      // Rótulos de faixa ("De X até Y") precisam da data mais tardia (Y).
      if (isos.length > 0) return isos.sort().at(-1)
    }
  }
  return undefined
}

// Dentro da página do edital, o(s) link(s) de PDF ficam em parágrafos soltos
// de `section.entry-content` — o menu do site tem outros ".pdf" (leis,
// resoluções) fora dessa seção. Quando há retificação, o link dela vem
// listado ANTES do edital original nesse bloco; pegar o primeiro cobre os
// dois casos (com e sem retificação) e sempre usa a versão mais recente.
async function pdfDoEdital(urlPagina: string): Promise<string | undefined> {
  const html = await buscarTexto(urlPagina)
  const $ = cheerio.load(html)
  return $('section.entry-content a[href$=".pdf"]').first().attr('href')
}

async function prazoDoPdf(urlPagina: string): Promise<string | undefined> {
  const hrefPdf = await pdfDoEdital(urlPagina)
  if (!hrefPdf) return undefined

  const resposta = await fetch(hrefPdf, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  })
  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status} ao baixar PDF em ${hrefPdf}`)
  }
  const dados = new Uint8Array(await resposta.arrayBuffer())

  const parser = new PDFParse({ data: dados })
  try {
    const { text } = await parser.getText()
    return extrairPrazoCronograma(text)
  } finally {
    await parser.destroy()
  }
}

export async function coletarFapeg(): Promise<Edital[]> {
  const html = await buscarTexto(URL_FAPEG, {
    validar: (corpo) => corpo.includes('planilhaview'),
  })
  const editais = parseFapeg(html, new Date().toISOString())
  if (editais.length === 0) {
    throw new Error('FAPEG retornou 0 editais abertos — layout mudou?')
  }
  for (const edital of editais) {
    if (edital.inscricaoFim) continue
    try {
      edital.inscricaoFim = await prazoDoPdf(edital.url)
    } catch {
      // Sem prazo é um estado válido — segue com "prazo no edital". Um PDF
      // ilegível ou fora do ar não pode derrubar a fonte inteira.
    }
  }
  return editais
}
