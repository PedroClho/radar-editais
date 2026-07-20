import { describe, expect, test } from 'vitest'
import { limparTitulo, normalizarCaixa, resumir } from '../lib/editais'

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
