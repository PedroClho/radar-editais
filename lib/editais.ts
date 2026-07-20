import { normalizar } from '../scraper/classificador'
import type { Edital, Fonte } from '../scraper/schema'

// Prefixo burocrático das chamadas: "Chamada [Pública] <órgão> nº 12/2026 - ".
// O assunto real vem depois do hífen; o número vira linha secundária.
const RE_CHAMADA =
  /^chamada\s+(?:p[úu]blica\s+)?(\S+?)\s+n[ºo°]\s*(\d{1,3}\/\d{4})\s*[-–—]\s*(.+)$/i

export function limparTitulo(titulo: string): {
  titulo: string
  referencia?: string
} {
  const m = titulo.trim().match(RE_CHAMADA)
  if (!m) return { titulo }
  const [, orgao, numero, resto] = m
  const assunto = resto.trim()
  // Sem assunto sobrando, cortar só destruiria informação.
  if (!assunto) return { titulo }
  return { titulo: assunto, referencia: `${orgao} nº ${numero}` }
}

// Siglas que sobrevivem à normalização mesmo tendo mais de 5 letras.
const SIGLAS = new Set([
  'MMULHERES',
  'EMBRAPII',
  'SEBRAE',
  'FAPESP',
  'FAPEMIG',
])

const ATONAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'por', 'com', 'a', 'o', 'as', 'os', 'ao', 'aos', 'à', 'às',
  'um', 'uma', 'que', 'the',
])

function ehSigla(token: string, partOfSlash: boolean): boolean {
  const limpo = token.replace(/[^\p{L}]/gu, '')
  if (!limpo) return true // pontuação/números passam intactos
  if (SIGLAS.has(limpo)) return true
  // Fora de um composto tipo "MCTI/FINEP", uma palavra maiúscula curta é só
  // uma palavra comum no meio do texto gritado (ex.: "CARTA", "DE") — em
  // texto todo em caixa alta, "já está maiúscula" não distingue sigla de
  // palavra comum. Dentro do composto, o padrão é o de código de órgão.
  if (!partOfSlash) return false
  return limpo === limpo.toUpperCase() && limpo.length <= 5
}

function capitalizar(palavra: string): string {
  return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase()
}

// Só age em texto predominantemente maiúsculo — a FINEP entrega título e
// descrição gritando. Texto já em caixa mista passa intacto.
export function normalizarCaixa(
  texto: string,
  modo: 'titulo' | 'frase' = 'titulo',
): string {
  const letras = texto.match(/\p{L}/gu) ?? []
  if (letras.length < 8) return texto
  const maiusculas = letras.filter((c) => c === c.toUpperCase()).length
  if (maiusculas / letras.length < 0.7) return texto

  const palavras = texto.split(/(\s+)/)
  let primeiraFeita = false

  return palavras
    .map((token) => {
      if (/^\s+$/.test(token)) return token
      // "MCTI/FINEP" precisa ser resolvido pedaço a pedaço.
      const partOfSlash = token.includes('/')
      const partes = token.split('/').map((parte) => {
        if (/\d/.test(parte)) return parte
        if (ehSigla(parte, partOfSlash)) return parte
        const minuscula = parte.toLowerCase()
        if (modo === 'frase') return minuscula
        if (primeiraFeita && ATONAS.has(minuscula)) return minuscula
        return capitalizar(parte)
      })
      const resultado = partes.join('/')
      if (/\p{L}/u.test(token)) primeiraFeita = true
      return resultado
    })
    .join('')
    .replace(/^(\P{L}*)(\p{L})/u, (_, antes, letra) => antes + letra.toUpperCase())
}

export function resumir(texto: string, max = 180): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= max) return limpo
  const cortado = limpo.slice(0, max)
  const ultimoEspaco = cortado.lastIndexOf(' ')
  return `${(ultimoEspaco > 0 ? cortado.slice(0, ultimoEspaco) : cortado).replace(/[,.;:]$/, '')}…`
}

const FUSO = 'America/Sao_Paulo'
const DIA_MS = 86_400_000

const FMT_DIA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

// Índice do dia de calendário em São Paulo. Passa por Intl de propósito:
// o build roda em UTC e o navegador em BRT, e getDate() local daria
// resultados diferentes nos dois — quebrando a hidratação.
function diaCalendario(ms: number): number {
  const [dia, mes, ano] = FMT_DIA.format(new Date(ms)).split('/').map(Number)
  return Date.UTC(ano, mes - 1, dia) / DIA_MS
}

export function diasAte(fimIso: string, agoraMs: number): number {
  return diaCalendario(new Date(fimIso).getTime()) - diaCalendario(agoraMs)
}

export type Urgencia = 'critico' | 'proximo' | 'neutro'

export function nivelUrgencia(dias: number | null): Urgencia {
  if (dias === null) return 'neutro'
  if (dias <= 3) return 'critico'
  if (dias <= 14) return 'proximo'
  return 'neutro'
}

export type Grupos = {
  estaSemana: Edital[]
  proximasSemanas: Edital[]
  maisAdiante: Edital[]
  semPrazo: Edital[]
}

export function agruparPorPrazo(editais: Edital[], agoraMs: number): Grupos {
  const g: Grupos = {
    estaSemana: [],
    proximasSemanas: [],
    maisAdiante: [],
    semPrazo: [],
  }
  for (const e of editais) {
    if (e.situacao === 'encerrado') continue
    if (!e.inscricaoFim) {
      g.semPrazo.push(e)
      continue
    }
    const dias = diasAte(e.inscricaoFim, agoraMs)
    // A situação vinda da fonte não é confiável: a FINEP entrega editais
    // marcados "aberta" com prazo meses no passado. O prazo manda.
    if (dias < 0) continue
    if (dias <= 7) g.estaSemana.push(e)
    else if (dias <= 30) g.proximasSemanas.push(e)
    else g.maisAdiante.push(e)
  }
  const porPrazo = (a: Edital, b: Edital) =>
    (a.inscricaoFim ?? '').localeCompare(b.inscricaoFim ?? '')
  g.estaSemana.sort(porPrazo)
  g.proximasSemanas.sort(porPrazo)
  g.maisAdiante.sort(porPrazo)
  g.semPrazo.sort((a, b) => b.coletadoEm.localeCompare(a.coletadoEm))
  return g
}

export function filtrar(
  editais: Edital[],
  f: { busca: string; fonte: Fonte | null; areas: string[] },
): Edital[] {
  const termo = normalizar(f.busca.trim())
  return editais.filter(
    (e) =>
      (!f.fonte || e.fonte === f.fonte) &&
      (f.areas.length === 0 || f.areas.some((a) => e.areas.includes(a))) &&
      (!termo ||
        normalizar(`${e.titulo} ${e.descricao ?? ''}`).includes(termo)),
  )
}
