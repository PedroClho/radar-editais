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
