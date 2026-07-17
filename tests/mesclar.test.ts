import { describe, expect, test } from 'vitest'
import { mesclar } from '../scraper/mesclar'
import type { Dados, Edital } from '../scraper/schema'

const AGORA = '2026-07-17T12:00:00.000Z'
const ONTEM = '2026-07-16T12:00:00.000Z'

function edital(parcial: Partial<Edital> & { id: string }): Edital {
  return {
    fonte: 'finep',
    titulo: 'Edital de teste',
    url: 'https://example.com/edital',
    situacao: 'aberto',
    areas: ['geral'],
    ia: false,
    coletadoEm: AGORA,
    ...parcial,
  }
}

const anterior: Dados = {
  atualizadoEm: ONTEM,
  fontes: {
    finep: { ok: true, quantidade: 1, atualizadoEm: ONTEM },
    cnpq: { ok: true, quantidade: 1, atualizadoEm: ONTEM },
    fapeg: { ok: true, quantidade: 0, atualizadoEm: ONTEM },
    capes: { ok: true, quantidade: 0, atualizadoEm: ONTEM },
  },
  editais: [
    edital({ id: 'finep-antigo', fonte: 'finep', coletadoEm: ONTEM }),
    edital({ id: 'cnpq-antigo', fonte: 'cnpq', coletadoEm: ONTEM }),
  ],
}

describe('mesclar', () => {
  test('fonte que falhou reusa os editais anteriores e fica ok:false', () => {
    const dados = mesclar(
      {
        finep: { editais: [edital({ id: 'finep-novo' })] },
        cnpq: { erro: 'timeout' },
        fapeg: { editais: [] },
        capes: { editais: [] },
      },
      anterior,
      AGORA,
    )
    expect(dados.editais.map((e) => e.id)).toContain('cnpq-antigo')
    expect(dados.editais.map((e) => e.id)).not.toContain('finep-antigo')
    expect(dados.fontes.cnpq).toMatchObject({
      ok: false,
      erro: 'timeout',
      atualizadoEm: ONTEM, // última coleta boa
    })
    expect(dados.fontes.finep).toMatchObject({ ok: true, quantidade: 1 })
  })

  test('sem dados anteriores, fonte que falhou fica vazia mas não derruba', () => {
    const dados = mesclar(
      {
        finep: { erro: 'HTTP 500' },
        cnpq: { editais: [edital({ id: 'cnpq-novo', fonte: 'cnpq' })] },
        fapeg: { erro: 'DNS' },
        capes: { editais: [] },
      },
      undefined,
      AGORA,
    )
    expect(dados.editais).toHaveLength(1)
    expect(dados.fontes.finep.ok).toBe(false)
    expect(dados.fontes.finep.quantidade).toBe(0)
  })

  test('ordena por prazo crescente com sem-prazo no fim', () => {
    const dados = mesclar(
      {
        finep: {
          editais: [
            edital({ id: 'sem-prazo' }),
            edital({ id: 'longe', inscricaoFim: '2026-12-01T23:59:59.000Z' }),
            edital({ id: 'perto', inscricaoFim: '2026-07-20T23:59:59.000Z' }),
          ],
        },
        cnpq: { editais: [] },
        fapeg: { editais: [] },
        capes: { editais: [] },
      },
      undefined,
      AGORA,
    )
    expect(dados.editais.map((e) => e.id)).toEqual([
      'perto',
      'longe',
      'sem-prazo',
    ])
  })

  test('remove duplicatas pelo id', () => {
    const dados = mesclar(
      {
        finep: {
          editais: [edital({ id: 'dup' }), edital({ id: 'dup' })],
        },
        cnpq: { editais: [] },
        fapeg: { editais: [] },
        capes: { editais: [] },
      },
      undefined,
      AGORA,
    )
    expect(dados.editais).toHaveLength(1)
  })
})
