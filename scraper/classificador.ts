// Classificação por palavras-chave (decisão de projeto: sem LLM, custo zero).
// Termos do dicionário já devem estar normalizados (minúsculos, sem acento).
// Sufixo '*' casa qualquer continuação da palavra: 'farmac*' pega farmácia,
// fármaco, farmacêutica...

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export const TERMOS_IA = [
  'ia',
  'inteligencia artificial',
  'artificial intelligence',
  'machine learning',
  'aprendizado de maquina',
  'aprendizagem de maquina',
  'deep learning',
  'ciencia de dados',
  'visao computacional',
  'processamento de linguagem natural',
  'redes neurais',
  'llm',
  'modelos de linguagem',
]

export const AREAS: Record<string, string[]> = {
  saude: [
    'saude',
    'sus',
    'medicina',
    'medico*',
    'medicamento*',
    'hospital*',
    'clinic*',
    'farmac*',
    'biomedic*',
    'endometriose',
    'doenca*',
    'vacina*',
    'telessaude',
    'epidemi*',
    'enferm*',
  ],
  agro: [
    'agro*',
    'agric*',
    'pecuari*',
    'rura*',
    'cerrado',
    'safra*',
    'irrigacao',
    'bioinsumo*',
  ],
  tecnologia: [
    'tecnolog*',
    'inovacao',
    'inovador*',
    'startup*',
    'software*',
    'hardware*',
    'digital*',
    'semicondutor*',
    'computacao',
    'internet das coisas',
    'iot',
    'robotic*',
    'ciberseguranca',
    'telecom*',
  ],
  educacao: [
    'educacao',
    'educacional*',
    'ensino',
    'escola*',
    'alfabetizacao',
    'docente*',
    'docencia',
    'pos-graduacao',
    'mestrado*',
    'doutorado*',
    'professor*',
    'pibic',
    'pibpg',
    'pec-pg',
  ],
  energia: [
    'energia*',
    'energetic*',
    'solar',
    'eolic*',
    'biocombustive*',
    'hidrogenio',
    'petroleo',
  ],
  industria: ['industria*', 'manufatura*', 'mineracao', 'metalurg*'],
  sustentabilidade: [
    'sustentab*',
    'meio ambiente',
    'ambiental*',
    'clima',
    'climatic*',
    'biodiversidade',
    'residuo*',
    'reciclagem',
    'descarboniza*',
    'bioeconomia',
  ],
}

// Rótulos de exibição (o front importa daqui para não duplicar a lista).
export const ROTULOS: Record<string, string> = {
  ia: 'IA',
  saude: 'Saúde',
  agro: 'Agro',
  tecnologia: 'Tecnologia',
  educacao: 'Educação',
  energia: 'Energia',
  industria: 'Indústria',
  sustentabilidade: 'Sustentabilidade',
  geral: 'Geral',
}

function regexDoTermo(termo: string): RegExp {
  const prefixo = termo.endsWith('*')
  const corpo = (prefixo ? termo.slice(0, -1) : termo).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
  return new RegExp(`\\b${corpo}${prefixo ? '' : '\\b'}`)
}

function casaAlgum(textoNormalizado: string, termos: string[]): boolean {
  return termos.some((t) => regexDoTermo(t).test(textoNormalizado))
}

export function classificar(texto: string): { areas: string[]; ia: boolean } {
  const t = normalizar(texto)
  const ia = casaAlgum(t, TERMOS_IA)
  const areas = Object.keys(AREAS).filter((area) => casaAlgum(t, AREAS[area]))
  return { areas: areas.length > 0 ? areas : ['geral'], ia }
}
