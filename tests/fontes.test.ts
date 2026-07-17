import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parseCapes } from '../scraper/fontes/capes'
import { parseCnpq } from '../scraper/fontes/cnpq'
import { parseFapeg } from '../scraper/fontes/fapeg'
import { parseFinep } from '../scraper/fontes/finep'
import { EditalSchema } from '../scraper/schema'
import { dataBrParaIso, fimDoDiaIso, gerarId } from '../scraper/util'

const AGORA = '2026-07-17T12:00:00.000Z'

function fixture(nome: string): string {
  return readFileSync(join(__dirname, 'fixtures', nome), 'utf-8')
}

describe('util', () => {
  test('dataBrParaIso converte dd/mm/yyyy e dd/mm/yy', () => {
    expect(dataBrParaIso('03/08/2026')).toBe('2026-08-03T00:00:00.000Z')
    expect(dataBrParaIso('30/09/26', { fimDoDia: true })).toBe(
      '2026-09-30T23:59:59.000Z',
    )
    expect(dataBrParaIso('data inválida')).toBeUndefined()
    expect(dataBrParaIso('99/99/2026')).toBeUndefined()
  })

  test('fimDoDiaIso empurra para o fim do dia', () => {
    expect(fimDoDiaIso('2026-11-19T00:00:00.000Z')).toBe(
      '2026-11-19T23:59:59.000Z',
    )
  })

  test('gerarId é estável e prefixado pela fonte', () => {
    expect(gerarId('finep', 'https://x')).toBe(gerarId('finep', 'https://x'))
    expect(gerarId('finep', 'https://x')).toMatch(/^finep-[0-9a-f]{12}$/)
  })
})

describe('parseFinep', () => {
  const editais = parseFinep(JSON.parse(fixture('finep-abertas.json')), AGORA)

  test('extrai as chamadas abertas e aprovadas', () => {
    expect(editais.length).toBeGreaterThanOrEqual(30)
    for (const e of editais) EditalSchema.parse(e)
  })

  test('monta URL de detalhe verificada e prazo do vigenciaFim', () => {
    const brics = editais.find((e) => e.titulo.includes('BRICs'))
    expect(brics).toBeDefined()
    expect(brics!.url).toMatch(
      /^https:\/\/www\.finep\.gov\.br\/e\/chamada-publica\/222684\/\d+$/,
    )
    expect(brics!.inscricaoFim).toBe('2026-11-19T23:59:59.000Z')
    expect(brics!.situacao).toBe('aberto')
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
    expect(universal!.inscricaoInicio).toBe('2026-06-17T00:00:00.000Z')
    expect(universal!.inscricaoFim).toBe('2026-08-03T23:59:59.000Z')
  })

  test('entende ano com 2 dígitos (30/06/26 a 30/09/26)', () => {
    expect(
      editais.some((e) => e.inscricaoFim === '2026-09-30T23:59:59.000Z'),
    ).toBe(true)
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
