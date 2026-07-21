import { normalizar } from '../scraper/classificador'
import type { Edital, Fonte } from '../scraper/schema'

// Prefixo burocrático das chamadas: "Chamada|Chamamento [Públic(a|o)]
// [<órgão>] nº 12/2026 [—] <assunto>". O assunto real vem depois do número;
// o número vira linha secundária. Variações reais cobertas: "Chamamento
// Público" (CNPq), texto entre o número e o traço ("Nº 20/2026 Atlânticas -
// Programa..."), e o padrão CAPES com a referência no FIM ("... - Edital
// nº 20/2026").
const RE_CHAMADA =
  /^(?:chamada|chamamento)\s+(?:p[úu]blic[ao]\s+)?(.*?)\s*n[ºo°]\s*(\d{1,3}\/\d{4})\s*[-–—:]?\s*(.*)$/i

const RE_CHAMADA_NO_FIM =
  /^(?:chamada|chamamento)\s+(?:p[úu]blic[ao]\s+)?(?:para\s+)?(.+?)\s*[-–—]\s*edital\s+n[ºo°]\s*(\d{1,3}\/\d{4})$/i

// Código de órgão tem ao menos duas maiúsculas seguidas ("CNPq", "MCTI",
// "CNPq/Decit-SCTIE-MS"). Serve para descartar palavras comuns que caem no
// grupo por acidente ("Complementar").
const RE_ORGAO = /\p{Lu}{2}/u

export function limparTitulo(titulo: string): {
  titulo: string
  referencia?: string
} {
  const bruto = titulo.trim()

  // Padrão CAPES: o assunto vem primeiro e a referência fecha o título.
  const fim = bruto.match(RE_CHAMADA_NO_FIM)
  if (fim) {
    const [, assunto, numero] = fim
    if (assunto.trim()) {
      return { titulo: assunto.trim(), referencia: `nº ${numero}` }
    }
  }

  const m = bruto.match(RE_CHAMADA)
  if (!m) return { titulo }
  const [, orgaoBruto, numero, resto] = m
  // "Para Participação no Programa..." lê melhor sem a preposição de ligação.
  const assunto = resto.trim().replace(/^para\s+/i, '')
  // Sem assunto sobrando, cortar só destruiria informação.
  if (!assunto) return { titulo }
  // O órgão é o último token antes do número; multi-palavra ali é assunto
  // capturado por engano, não órgão.
  const orgao = orgaoBruto.trim().split(/\s+/).at(-1) ?? ''
  const prefixo =
    orgao && !orgaoBruto.trim().includes(' ') && RE_ORGAO.test(orgao)
      ? `${orgao} `
      : ''
  return {
    titulo: assunto.charAt(0).toUpperCase() + assunto.slice(1),
    referencia: `${prefixo}nº ${numero}`,
  }
}

// Siglas de agência/programa que precisam sobreviver à normalização mesmo
// soltas no meio de um título gritado. Lista curada a partir dos tokens
// todo-maiúsculos que de fato aparecem no dataset — em texto 100% maiúsculo
// não existe heurística que separe "MCTI" de "CARTA" sem conhecer o domínio.
// Nomes de programa pronunciáveis (TECNOVA, PROINFRA) ficam de FORA de
// propósito: "Programa Tecnova" lê melhor que "Programa TECNOVA".
const SIGLAS = new Set([
  'MMULHERES',
  'EFPC',
  'EMBRAPII',
  'SEBRAE',
  'FAPESP',
  'FAPEMIG',
  'MCTI',
  'FINEP',
  'CNPq',
  'CAPES',
  'FAPEG',
  'FNDCT',
  'CDTI',
  'BNDES',
  'BNDESPAR',
  'MRE',
  'MinC',
  'SUS',
  'ERC',
  'CONFAP',
  'FIP',
  'PDI',
  'ICT',
  'ICTs',
  'PIBPG',
  'SCTIE',
  'DECIT',
  'BRICS',
  'UFG',
  'IA',
])

const ATONAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'por', 'com', 'a', 'o', 'as', 'os', 'ao', 'aos', 'à', 'às',
  'um', 'uma', 'que', 'the',
])

function ehSigla(token: string, dentroDeComposto: boolean): boolean {
  const limpo = token.replace(/[^\p{L}]/gu, '')
  if (!limpo) return true // pontuação/números passam intactos
  if (SIGLAS.has(limpo)) return true
  // Fora de um composto tipo "MCTI/FINEP" ou "PEC-PG", uma palavra maiúscula
  // curta é só uma palavra comum no meio do texto gritado (ex.: "CARTA",
  // "DE") — em texto todo em caixa alta, "já está maiúscula" não distingue
  // sigla de palavra comum. Dentro do composto, o padrão é código de órgão.
  if (!dentroDeComposto) return false
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
      // "MCTI/FINEP" e "ERC-CONFAP" precisam ser resolvidos pedaço a pedaço,
      // preservando o separador original.
      const dentroDeComposto = /[/-]/.test(token)
      const partes = token.split(/([/-])/).map((parte) => {
        if (parte === '/' || parte === '-') return parte
        // Dígitos e símbolos ("2026/2027", "R$") passam intactos.
        if (/[\d$&%]/.test(parte)) return parte
        if (ehSigla(parte, dentroDeComposto)) return parte
        const minuscula = parte.toLowerCase()
        if (modo === 'frase') return minuscula
        if (primeiraFeita && ATONAS.has(minuscula)) return minuscula
        return capitalizar(parte)
      })
      const resultado = partes.join('')
      if (/\p{L}/u.test(token)) primeiraFeita = true
      return resultado
    })
    .join('')
    .replace(/^(\P{L}*)(\p{L})/u, (_, antes, letra) => antes + letra.toUpperCase())
}

// A FAPEG entrega a coluna "Origem" da tabela no campo `descricao`. É
// informação útil — nomeia os co-financiadores — mas não descreve o edital, e
// ocupando a linha da descrição só gasta espaço. Vira metadado.
const RE_ORIGEM = /^origem:\s*(.+)$/i

export function separarOrigem(descricao?: string): {
  texto?: string
  origem?: string
} {
  const limpo = descricao?.trim()
  if (!limpo) return {}
  const m = limpo.match(RE_ORIGEM)
  return m ? { origem: m[1].trim() } : { texto: limpo }
}

export function resumir(texto: string, max = 180): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= max) return limpo
  const cortado = limpo.slice(0, max)
  const ultimoEspaco = cortado.lastIndexOf(' ')
  return `${(ultimoEspaco > 0 ? cortado.slice(0, ultimoEspaco) : cortado).replace(/[,.;:]$/, '')}…`
}

// Descrições da FINEP às vezes abrem repetindo o título inteiro — exibir as
// duas coisas empilhadas gasta o line-clamp com redundância. A comparação é
// normalizada (a limpeza preserva o comprimento caractere a caractere).
export function tirarPrefixoDeTitulo(descricao: string, titulo: string): string {
  const desc = descricao.trim()
  const alvo = normalizar(titulo.trim())
  if (!alvo || normalizar(desc).slice(0, alvo.length) !== alvo) return desc
  const resto = desc.slice(alvo.length).replace(/^[\s\-–—:.,]+/, '')
  return resto || desc
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

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g

export function filtrar(
  editais: Edital[],
  f: { busca: string; fonte: Fonte | null; areas: string[] },
): Edital[] {
  const termo = normalizar(f.busca.trim())
  // Termo curto casa por palavra inteira: "ia" por substring devolvia 75% do
  // dataset (tecnologIA, estratégIA, ciêncIA...) — inútil justamente na
  // busca mais óbvia do público deste site.
  const reCurto =
    termo && termo.length <= 3
      ? new RegExp(
          `(?<![\\p{L}\\p{N}])${termo.replace(ESCAPE_RE, '\\$&')}(?![\\p{L}\\p{N}])`,
          'u',
        )
      : null
  const casaBusca = (e: Edital): boolean => {
    if (!termo) return true
    const texto = normalizar(`${e.titulo} ${e.descricao ?? ''}`)
    if (reCurto) {
      return reCurto.test(texto) || (termo === 'ia' && e.ia)
    }
    return texto.includes(termo)
  }
  return editais.filter(
    (e) =>
      (!f.fonte || e.fonte === f.fonte) &&
      // "ia" é pseudo-área: o classificador guarda IA como flag booleana,
      // porque é transversal (um edital de saúde pode ser de IA). Sem este
      // caso especial, IA seria a única categoria impossível de filtrar.
      (f.areas.length === 0 ||
        f.areas.some((a) => (a === 'ia' ? e.ia : e.areas.includes(a)))) &&
      casaBusca(e),
  )
}

// Ordem dos filtros de área que o usuário vê todo dia: por frequência no
// dataset vigente, com IA — o recorte que originou o projeto — sempre à
// frente quando existe. "geral" é ausência de rótulo, não área.
export function listarAreasDisponiveis(editais: Edital[]): string[] {
  const contagem = new Map<string, number>()
  for (const e of editais) {
    for (const a of e.areas) {
      if (a !== 'geral') contagem.set(a, (contagem.get(a) ?? 0) + 1)
    }
  }
  const ordenadas = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a]) => a)
  return editais.some((e) => e.ia) ? ['ia', ...ordenadas] : ordenadas
}

// Sinal de frescor do topo da página: se o GitHub Action parar em silêncio,
// "atualizado há N dias" é o único alarme visível sem rolar até o rodapé.
export function frescor(
  atualizadoEmIso: string,
  agoraMs: number,
): { texto: string; velho: boolean } {
  const dias = Math.max(
    0,
    diaCalendario(agoraMs) - diaCalendario(new Date(atualizadoEmIso).getTime()),
  )
  const texto =
    dias === 0
      ? 'atualizado hoje'
      : dias === 1
        ? 'atualizado ontem'
        : `atualizado há ${dias} dias`
  return { texto, velho: dias >= 2 }
}

// Nome de exibição de cada fonte. Fica aqui, e não nos componentes, porque
// os três (linha, controles e rodapé) precisam do mesmo mapa — e quem
// adiciona uma fonte nova deve ter um só lugar para mexer.
export const FONTES_UI: Fonte[] = ['finep', 'cnpq', 'fapeg', 'capes']

export const NOMES_FONTES: Record<Fonte, string> = {
  finep: 'FINEP',
  cnpq: 'CNPq',
  fapeg: 'FAPEG',
  capes: 'CAPES',
}
