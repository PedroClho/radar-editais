import { describe, expect, test } from 'vitest'
import { EditalSchema } from '../scraper/schema'

const base = {
  id: 'finep-abc123',
  fonte: 'finep',
  titulo: 'Chamada Pública Teste',
  url: 'https://www.finep.gov.br/oportunidades',
  situacao: 'aberto',
  areas: ['geral'],
  ia: false,
  coletadoEm: '2026-07-17T12:00:00.000Z',
}

describe('EditalSchema', () => {
  test('aceita um edital válido (campos opcionais ausentes)', () => {
    expect(EditalSchema.parse(base)).toMatchObject(base)
  })

  test('rejeita fonte desconhecida', () => {
    expect(() => EditalSchema.parse({ ...base, fonte: 'fapesp' })).toThrow()
  })

  test('rejeita url inválida', () => {
    expect(() => EditalSchema.parse({ ...base, url: 'nao-e-url' })).toThrow()
  })

  test('rejeita título vazio', () => {
    expect(() => EditalSchema.parse({ ...base, titulo: '' })).toThrow()
  })
})
