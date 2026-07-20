import { describe, expect, test } from 'vitest'
import {
  agruparPorPrazo,
  diasAte,
  filtrar,
  limparTitulo,
  nivelUrgencia,
  normalizarCaixa,
  resumir,
} from '../lib/editais'
import type { Edital } from '../scraper/schema'

describe('limparTitulo', () => {
  test('separa o prefixo burocrático do CNPq do assunto', () => {
    const r = limparTitulo(
      'Chamada CNPq/Decit-SCTIE-MS Nº 18/2026 - Avaliações de Políticas, Programas, Projetos e Ações em Saúde',
    )
    expect(r.titulo).toBe(
      'Avaliações de Políticas, Programas, Projetos e Ações em Saúde',
    )
    expect(r.referencia).toBe('CNPq/Decit-SCTIE-MS nº 18/2026')
  })

  test('aceita "Chamada Pública" e o sinal de grau no lugar do ordinal', () => {
    const r = limparTitulo(
      'Chamada Pública CNPq N° 07/2026 - Programa Institucional de Bolsas de Pós-Graduação (PIBPG)',
    )
    expect(r.titulo).toBe(
      'Programa Institucional de Bolsas de Pós-Graduação (PIBPG)',
    )
    expect(r.referencia).toBe('CNPq nº 07/2026')
  })

  test('aceita travessão no lugar do hífen', () => {
    const r = limparTitulo('Chamada CNPq/FNDCT nº 06/2026 – UNIVERSAL')
    expect(r.titulo).toBe('UNIVERSAL')
    expect(r.referencia).toBe('CNPq/FNDCT nº 06/2026')
  })

  test('devolve intacto quando o padrão não casa — nunca perde informação', () => {
    const original = 'CARTA CONVITE MCTI/FINEP - PROGRAMA TECNOVA 2026/2027'
    expect(limparTitulo(original)).toEqual({ titulo: original })

    const outro = 'Agricultura familiar para ICTs 2026'
    expect(limparTitulo(outro)).toEqual({ titulo: outro })
  })

  test('não corta quando sobraria um título vazio', () => {
    const so = 'Chamada CNPq nº 06/2026 - '
    expect(limparTitulo(so).titulo).toBe(so)
  })
})

describe('normalizarCaixa', () => {
  test('desliga o CAIXA ALTA preservando siglas, em modo título', () => {
    expect(
      normalizarCaixa('CARTA CONVITE MCTI/FINEP - PROGRAMA TECNOVA 2026/2027'),
    ).toBe('Carta Convite MCTI/FINEP - Programa Tecnova 2026/2027')
  })

  test('em modo frase usa caixa de sentença, para descrições', () => {
    expect(
      normalizarCaixa(
        'SELEÇÃO PÚBLICA DE PROPOSTAS DOS AGENTES OPERACIONAIS',
        'frase',
      ),
    ).toBe('Seleção pública de propostas dos agentes operacionais')
  })

  test('deixa em paz texto que já está em caixa mista', () => {
    const ok = 'Programa Institucional de Bolsas de Pós-Graduação (PIBPG)'
    expect(normalizarCaixa(ok)).toBe(ok)
  })

  test('preserva números e siglas curtas', () => {
    expect(normalizarCaixa('DESAFIO TECNOLÓGICO ELETROLISADOR NACIONAL')).toBe(
      'Desafio Tecnológico Eletrolisador Nacional',
    )
  })
})

describe('resumir', () => {
  test('colapsa espaços repetidos e corta em limite de palavra', () => {
    const r = resumir('REAIS    Selecionar propostas de Agentes', 20)
    expect(r).toBe('REAIS Selecionar…')
    expect(r.length).toBeLessThanOrEqual(21)
  })

  test('não mexe em texto que já cabe', () => {
    expect(resumir('Texto curto', 100)).toBe('Texto curto')
  })
})

const AGORA = Date.parse('2026-07-20T12:00:00.000Z')

function edital(over: Partial<Edital> = {}): Edital {
  return {
    id: 'x',
    fonte: 'cnpq',
    titulo: 'Título',
    url: 'https://exemplo.br/a',
    situacao: 'aberto',
    areas: ['geral'],
    ia: false,
    coletadoEm: '2026-07-20T00:00:00.000Z',
    ...over,
  }
}

describe('diasAte', () => {
  test('conta dias de calendário no fuso de São Paulo', () => {
    expect(diasAte('2026-07-29T23:59:59.000Z', AGORA)).toBe(9)
  })

  test('o último dia é zero, não um', () => {
    expect(diasAte('2026-07-20T23:59:59.000Z', AGORA)).toBe(0)
  })

  test('prazo vencido é negativo', () => {
    expect(diasAte('2026-07-18T23:59:59.000Z', AGORA)).toBe(-2)
  })
})

describe('nivelUrgencia', () => {
  test('respeita os limites exatos das faixas', () => {
    expect(nivelUrgencia(0)).toBe('critico')
    expect(nivelUrgencia(3)).toBe('critico')
    expect(nivelUrgencia(4)).toBe('proximo')
    expect(nivelUrgencia(14)).toBe('proximo')
    expect(nivelUrgencia(15)).toBe('neutro')
  })

  test('sem prazo é neutro', () => {
    expect(nivelUrgencia(null)).toBe('neutro')
  })
})

describe('agruparPorPrazo', () => {
  test('distribui pelos quatro grupos', () => {
    const g = agruparPorPrazo(
      [
        edital({ id: 'a', inscricaoFim: '2026-07-25T23:59:59.000Z' }), // 5d
        edital({ id: 'b', inscricaoFim: '2026-08-10T23:59:59.000Z' }), // 21d
        edital({ id: 'c', inscricaoFim: '2026-12-01T23:59:59.000Z' }), // >30d
        edital({ id: 'd' }), // sem prazo
      ],
      AGORA,
    )
    expect(g.estaSemana.map((e) => e.id)).toEqual(['a'])
    expect(g.proximasSemanas.map((e) => e.id)).toEqual(['b'])
    expect(g.maisAdiante.map((e) => e.id)).toEqual(['c'])
    expect(g.semPrazo.map((e) => e.id)).toEqual(['d'])
  })

  test('descarta prazo vencido mesmo com situação "aberto" na origem', () => {
    // 6 editais da FINEP chegam assim: situacao aberta, prazo no passado.
    const g = agruparPorPrazo(
      [edital({ id: 'velho', inscricaoFim: '2026-05-28T23:59:59.000Z' })],
      AGORA,
    )
    expect(g.estaSemana).toHaveLength(0)
    expect(g.proximasSemanas).toHaveLength(0)
    expect(g.maisAdiante).toHaveLength(0)
    expect(g.semPrazo).toHaveLength(0)
  })

  test('descarta encerrado declarado pela fonte', () => {
    const g = agruparPorPrazo([edital({ situacao: 'encerrado' })], AGORA)
    expect(g.semPrazo).toHaveLength(0)
  })

  test('ordena por prazo crescente dentro do grupo', () => {
    const g = agruparPorPrazo(
      [
        edital({ id: 'depois', inscricaoFim: '2026-07-26T23:59:59.000Z' }),
        edital({ id: 'antes', inscricaoFim: '2026-07-22T23:59:59.000Z' }),
      ],
      AGORA,
    )
    expect(g.estaSemana.map((e) => e.id)).toEqual(['antes', 'depois'])
  })

  test('sem prazo vem do mais recentemente coletado para o mais antigo', () => {
    const g = agruparPorPrazo(
      [
        edital({ id: 'antigo', coletadoEm: '2026-07-01T00:00:00.000Z' }),
        edital({ id: 'novo', coletadoEm: '2026-07-19T00:00:00.000Z' }),
      ],
      AGORA,
    )
    expect(g.semPrazo.map((e) => e.id)).toEqual(['novo', 'antigo'])
  })
})

describe('filtrar', () => {
  const lista = [
    edital({ id: 'saude', areas: ['saude'], titulo: 'Endometriose' }),
    edital({ id: 'agro', areas: ['agro'], fonte: 'finep', titulo: 'Milho' }),
  ]

  test('sem filtro devolve tudo', () => {
    expect(filtrar(lista, { busca: '', fonte: null, areas: [] })).toHaveLength(2)
  })

  test('busca ignora acento e caixa', () => {
    const r = filtrar(lista, { busca: 'ENDOMETRIOSE', fonte: null, areas: [] })
    expect(r.map((e) => e.id)).toEqual(['saude'])
  })

  test('áreas funcionam como OU', () => {
    const r = filtrar(lista, { busca: '', fonte: null, areas: ['saude', 'agro'] })
    expect(r).toHaveLength(2)
  })

  test('fonte e área se combinam como E', () => {
    const r = filtrar(lista, { busca: '', fonte: 'finep', areas: ['saude'] })
    expect(r).toHaveLength(0)
  })
})
