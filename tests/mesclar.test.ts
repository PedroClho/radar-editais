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

  test('preserva coletadoEm de edital já visto — o campo significa "primeiro visto"', () => {
    const dados = mesclar(
      {
        finep: {
          editais: [
            edital({ id: 'finep-antigo', coletadoEm: AGORA }),
            edital({ id: 'finep-inedito', url: 'https://example.com/novo' }),
          ],
        },
        cnpq: { editais: [] },
        fapeg: { editais: [] },
        capes: { editais: [] },
      },
      anterior,
      AGORA,
    )
    const antigo = dados.editais.find((e) => e.id === 'finep-antigo')
    const inedito = dados.editais.find((e) => e.id === 'finep-inedito')
    expect(antigo!.coletadoEm).toBe(ONTEM) // valor da primeira coleta
    expect(inedito!.coletadoEm).toBe(AGORA)
  })

  test('deduplica registros com mesmo título+descrição na mesma fonte, preferindo o que tem prazo', () => {
    // Caso real: o CMS da FINEP tem a mesma oportunidade em duas URLs.
    const dados = mesclar(
      {
        finep: {
          editais: [
            edital({
              id: 'finep-a',
              url: 'https://example.com/721681',
              descricao: 'EDITAL DE SELEÇÃO PÚBLICA 2017',
            }),
            edital({
              id: 'finep-b',
              url: 'https://example.com/721708',
              descricao: 'EDITAL DE SELEÇÃO PÚBLICA 2017',
              inscricaoFim: '2026-12-01T23:59:59.000-03:00',
            }),
          ],
        },
        cnpq: { editais: [] },
        fapeg: { editais: [] },
        capes: { editais: [] },
      },
      undefined,
      AGORA,
    )
    expect(dados.editais).toHaveLength(1)
    expect(dados.editais[0].id).toBe('finep-b') // o que tem prazo vence
  })

  test('sem descrição não há dedupe por conteúdo — títulos podem coincidir', () => {
    const dados = mesclar(
      {
        capes: {
          editais: [
            edital({ id: 'capes-a', fonte: 'capes', url: 'https://example.com/a' }),
            edital({ id: 'capes-b', fonte: 'capes', url: 'https://example.com/b' }),
          ],
        },
        finep: { editais: [] },
        cnpq: { editais: [] },
        fapeg: { editais: [] },
      },
      undefined,
      AGORA,
    )
    expect(dados.editais).toHaveLength(2)
  })

  test('normaliza situacao pelo prazo: vencido vira encerrado no JSON', () => {
    const dados = mesclar(
      {
        finep: {
          editais: [
            edital({
              id: 'vencido',
              inscricaoFim: '2026-07-01T23:59:59.000-03:00',
              situacao: 'aberto',
            }),
            edital({
              id: 'vigente',
              inscricaoFim: '2026-12-01T23:59:59.000-03:00',
              situacao: 'aberto',
            }),
            edital({ id: 'sem-prazo', situacao: 'indefinido' }),
          ],
        },
        cnpq: { editais: [] },
        fapeg: { editais: [] },
        capes: { editais: [] },
      },
      undefined,
      AGORA,
    )
    const porId = new Map(dados.editais.map((e) => [e.id, e]))
    expect(porId.get('vencido')!.situacao).toBe('encerrado')
    expect(porId.get('vigente')!.situacao).toBe('aberto')
    expect(porId.get('sem-prazo')!.situacao).toBe('indefinido')
  })
})
