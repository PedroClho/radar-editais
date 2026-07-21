import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parseCapes } from '../scraper/fontes/capes'
import { parseCnpq, parseCnpqDetalhe } from '../scraper/fontes/cnpq'
import { extrairPrazoCronograma, parseFapeg } from '../scraper/fontes/fapeg'
import { parseFinep } from '../scraper/fontes/finep'
import { EditalSchema } from '../scraper/schema'
import { cortarEmPalavra, dataBrParaIso, fimDoDiaIso, gerarId } from '../scraper/util'

const AGORA = '2026-07-17T12:00:00.000Z'

function fixture(nome: string): string {
  return readFileSync(join(__dirname, 'fixtures', nome), 'utf-8')
}

const cronograma = readFileSync(
  new URL('./fixtures/fapeg-cronograma.txt', import.meta.url),
  'utf8',
)

describe('util', () => {
  test('dataBrParaIso converte dd/mm/yyyy e dd/mm/yy no fuso de Brasília', () => {
    expect(dataBrParaIso('03/08/2026')).toBe('2026-08-03T00:00:00.000-03:00')
    expect(dataBrParaIso('30/09/26', { fimDoDia: true })).toBe(
      '2026-09-30T23:59:59.000-03:00',
    )
    expect(dataBrParaIso('data inválida')).toBeUndefined()
    expect(dataBrParaIso('99/99/2026')).toBeUndefined()
  })

  test('fimDoDiaIso empurra para o fim do dia de Brasília', () => {
    expect(fimDoDiaIso('2026-11-19T00:00:00.000Z')).toBe(
      '2026-11-19T23:59:59.000-03:00',
    )
  })

  test('o prazo vale até a meia-noite de Brasília, não de Londres', () => {
    // 23:59:59-03:00 = 02:59:59Z do dia seguinte — entre 21h e 24h BRT o
    // edital ainda está vigente. Em UTC ("Z") ele expirava 3h mais cedo.
    const fim = new Date(fimDoDiaIso('2026-11-19')).getTime()
    const vinteDuasBrt = new Date('2026-11-20T01:00:00.000Z').getTime()
    expect(fim).toBeGreaterThan(vinteDuasBrt)
  })

  test('gerarId é estável e prefixado pela fonte', () => {
    expect(gerarId('finep', 'https://x')).toBe(gerarId('finep', 'https://x'))
    expect(gerarId('finep', 'https://x')).toMatch(/^finep-[0-9a-f]{12}$/)
  })

  test('cortarEmPalavra corta em limite de palavra e sinaliza com reticências', () => {
    expect(cortarEmPalavra('promovendo o desenvolvimento da biodiversidade', 40)).toBe(
      'promovendo o desenvolvimento da…',
    )
    expect(cortarEmPalavra('texto curto', 40)).toBe('texto curto')
    expect(cortarEmPalavra('espaços   colapsam\n\nsempre', 40)).toBe(
      'espaços colapsam sempre',
    )
  })
})

describe('parseFinep', () => {
  const editais = parseFinep(JSON.parse(fixture('finep-abertas.json')), AGORA)

  test('extrai as chamadas abertas e aprovadas', () => {
    expect(editais.length).toBe(28)
    for (const e of editais) EditalSchema.parse(e)
  })

  test('monta URL de detalhe verificada e prazo do prazoProposto', () => {
    const brics = editais.find((e) => e.titulo.includes('BRICs'))
    expect(brics).toBeDefined()
    expect(brics!.url).toMatch(
      /^https:\/\/www\.finep\.gov\.br\/e\/chamada-publica\/222684\/\d+$/,
    )
    expect(brics!.inscricaoFim).toBe('2026-08-14T23:59:59.000-03:00')
    expect(brics!.situacao).toBe('aberto')
  })

  test('usa prazoProposto em vez de vigenciaFim quando os dois divergem', () => {
    // id 991625 — "BRICs - CHAMADA PÚBLICA Cooperação Multilateral"
    // prazoProposto 2026-08-14, vigenciaFim 2026-11-19
    const brics = editais.find((e) => e.url.endsWith('/991625'))
    expect(brics).toBeDefined()
    expect(brics!.inscricaoFim).toBe('2026-08-14T23:59:59.000-03:00')
  })

  test('aproveita prazoProposto quando não há vigenciaFim', () => {
    // id 968467 — "DESAFIO TECNOLÓGICO ELETROLISADOR NACIONAL"
    const desafio = editais.find((e) => e.url.endsWith('/968467'))
    expect(desafio).toBeDefined()
    expect(desafio!.inscricaoFim).toBe('2026-09-21T23:59:59.000-03:00')
  })

  test('a cobertura de prazo segue em 22 editais', () => {
    expect(editais.filter((e) => e.inscricaoFim).length).toBe(22)
  })

  test('descarta lixo histórico: sem prazo e publicado há mais de 18 meses', () => {
    // A API entrega "COOPERAÇÃO ICT-EMPRESA – 01/2017" (publicado em 2017) e
    // "Chamada Pública Bilateral Finep-CDTI" (2015) como situacao 'aberta'.
    expect(editais.some((e) => e.titulo.includes('2017'))).toBe(false)
    expect(editais.some((e) => e.titulo.includes('Bilateral Finep-CDTI'))).toBe(
      false,
    )
  })

  test('sem prazo mas recente continua no radar', () => {
    // "FIP Bioeconomia e Sustentabilidade" — publicado em 2025-11, sem prazo.
    expect(
      editais.some((e) => e.titulo.includes('FIP Bioeconomia')),
    ).toBe(true)
  })

  test('detecta submissão em fluxo contínuo e não descarta por idade', () => {
    // "SOLUÇÕES TECNOLÓGICAS ... AGRICULTURA FAMILIAR" é de 2024-07 (velho),
    // mas a descrição diz "fluxo contínuo" — fica, com a flag ligada.
    const continua = editais.filter((e) => e.fluxoContinuo)
    expect(continua.length).toBeGreaterThanOrEqual(1)
    expect(
      continua.some((e) => e.titulo.includes('AGRICULTURA FAMILIAR')),
    ).toBe(true)
  })

  test('persiste o público-alvo canonizado (faixas de receita viram "empresas")', () => {
    const brics = editais.find((e) => e.url.endsWith('/991625'))
    expect(brics!.publicoAlvo).toEqual(['empresas'])
  })

  test('descrição longa é cortada em limite de palavra com reticências', () => {
    for (const e of editais) {
      if (!e.descricao) continue
      expect(e.descricao.length).toBeLessThanOrEqual(600)
      // nunca termina em fragmento cru de slice
      if (e.descricao.length === 600) expect(e.descricao.endsWith('…')).toBe(true)
    }
    expect(editais.some((e) => e.descricao?.endsWith('…'))).toBe(true)
  })
})

describe('parseCnpq', () => {
  const editais = parseCnpq(fixture('cnpq-abertas.html'), AGORA)

  test('extrai as 10 chamadas da página curada', () => {
    expect(editais).toHaveLength(10)
    for (const e of editais) EditalSchema.parse(e)
  })

  test('endometriose é rotulada como saúde', () => {
    const endo = editais.find((e) => e.titulo.includes('Endometriose'))
    expect(endo).toBeDefined()
    expect(endo!.areas).toContain('saude')
  })

  test('extrai o período de inscrições em dd/mm/yyyy', () => {
    const universal = editais.find((e) => e.titulo.includes('UNIVERSAL'))
    expect(universal!.inscricaoInicio).toBe('2026-06-17T00:00:00.000-03:00')
    expect(universal!.inscricaoFim).toBe('2026-08-03T23:59:59.000-03:00')
  })

  test('entende ano com 2 dígitos (30/06/26 a 30/09/26)', () => {
    expect(
      editais.some((e) => e.inscricaoFim === '2026-09-30T23:59:59.000-03:00'),
    ).toBe(true)
  })
})

describe('parseCnpqDetalhe', () => {
  test('extrai o primeiro parágrafo real da página da chamada', () => {
    const descricao = parseCnpqDetalhe(fixture('cnpq-detalhe.html'))
    expect(descricao).toBeDefined()
    expect(descricao).toContain('Decit/SCTIE/MS')
    expect(descricao!.length).toBeLessThanOrEqual(600)
  })

  test('devolve undefined para página sem conteúdo', () => {
    expect(parseCnpqDetalhe('<html><body></body></html>')).toBeUndefined()
  })
})

describe('parseFapeg', () => {
  const editais = parseFapeg(fixture('fapeg-abertas.html'), AGORA)

  test('extrai as linhas da tabela de inscrições abertas', () => {
    expect(editais).toHaveLength(5)
    for (const e of editais) EditalSchema.parse(e)
  })

  test('compõe título com tipo, número e descrição', () => {
    const mobility = editais.find((e) => e.titulo.includes('Mobility'))
    expect(mobility).toBeDefined()
    expect(mobility!.titulo).toContain('15/2026')
    expect(mobility!.url).toContain('goias.gov.br/fapeg/')
  })

  test('edital de educação especial é rotulado educacao', () => {
    const inclusiva = editais.find((e) => e.titulo.includes('INCLUSIVA'))
    expect(inclusiva!.areas).toContain('educacao')
  })
})

describe('parseCapes', () => {
  const editais = parseCapes(fixture('capes.html'), AGORA)

  test('extrai os editais da lista curada com URL absoluta', () => {
    expect(editais.length).toBeGreaterThanOrEqual(2)
    for (const e of editais) {
      EditalSchema.parse(e)
      expect(e.url).toMatch(/^https:\/\/www\.gov\.br\//)
      expect(e.inscricaoFim).toBeUndefined()
    }
  })

  test('mantém o título do edital', () => {
    expect(editais.some((e) => e.titulo.includes('Edital nº 20/2026'))).toBe(
      true,
    )
  })
})

describe('extrairPrazoCronograma', () => {
  test('acha a data limite de submissão no cronograma do PDF', () => {
    // Fixture real: Chamada Pública FAPEG nº 12/2026 (1ª retificação), item
    // "2. CRONOGRAMA" — "Limite para Submissão das propostas na Plataforma
    // Sparkx-FAPEG até às 17:00 horas do dia 10/08/2026".
    expect(extrairPrazoCronograma(cronograma)).toBe('2026-08-10T23:59:59.000-03:00')
  })

  test('devolve undefined quando não há cronograma', () => {
    expect(extrairPrazoCronograma('texto qualquer sem datas')).toBeUndefined()
  })

  test('ignora o sumário e pega a tabela real', () => {
    const comSumario = [
      '1. OBJETO .... 3',
      '7. CRONOGRAMA .... 12',
      'blá blá',
      'CRONOGRAMA',
      'Limite para Submissão das propostas até às 17:00 horas do dia 10/07/2026',
    ].join('\n')
    expect(extrairPrazoCronograma(comSumario)).toBe('2026-07-10T23:59:59.000-03:00')
  })

  test('aceita a variação de rótulo "Limite para Inscrições"', () => {
    const texto = [
      'CRONOGRAMA',
      'Limite para Inscrições na plataforma SPARKX FAPEG De 25/06/2026 até 04/08/2026 às 17h',
    ].join('\n')
    expect(extrairPrazoCronograma(texto)).toBe('2026-08-04T23:59:59.000-03:00')
  })

  test('não deixa a data da linha seguinte da tabela vazar quando o rótulo já tem data própria', () => {
    // Bug real descoberto nas fixtures da FAPEG: alguns PDFs extraem a linha
    // "Limite para Inscrições ... 04/08/2026" já com data própria, seguida
    // por outra linha de tabela que também tem data (resultado preliminar).
    // Uma janela de busca larga demais pegaria essa data errada.
    const texto = [
      'CRONOGRAMA',
      'Limite para Inscrições na plataforma SPARKX FAPEG De 25/06/2026 até 04/08/2026 às 17h',
      '1ª ETAPA: ENQUADRAMENTO',
      'Divulgação do resultado preliminar da etapa de enquadramento A partir de 10/08/2026',
    ].join('\n')
    expect(extrairPrazoCronograma(texto)).toBe('2026-08-04T23:59:59.000-03:00')
  })

  test('acompanha a data quando ela cai 2 linhas abaixo do rótulo (quebra de célula do PDF)', () => {
    // Bug real: "Limite para Submissão das propostas na" / "Plataforma
    // Sparkx-FAPEG" / "até às 17:00 horas do dia 10/08/2026" — a extração
    // do PDF quebra a célula da tabela em 3 linhas: o rótulo, o meio, e só
    // então a data. Um regex de linha única (sem olhar adiante) não acha
    // nada aqui.
    const texto = [
      'Limite para Submissão das propostas na',
      'Plataforma Sparkx-FAPEG',
      'até às 17:00 horas do dia 10/08/2026',
    ].join('\n')
    expect(extrairPrazoCronograma(texto)).toBe('2026-08-10T23:59:59.000-03:00')
  })
})
