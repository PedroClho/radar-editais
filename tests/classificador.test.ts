import { describe, expect, test } from 'vitest'
import { classificar, normalizar } from '../scraper/classificador'

describe('normalizar', () => {
  test('remove acentos e põe em minúsculas', () => {
    expect(normalizar('Inteligência Artificial')).toBe('inteligencia artificial')
    expect(normalizar('PÓS-GRADUAÇÃO')).toBe('pos-graduacao')
    expect(normalizar('Saúde é Ciência')).toBe('saude e ciencia')
  })
})

describe('classificar', () => {
  test('detecta saúde em título real do CNPq', () => {
    const r = classificar('Chamada CNPq nº 25/2026 – Pesquisas em Endometriose')
    expect(r.areas).toContain('saude')
    expect(r.ia).toBe(false)
  })

  test('detecta IA como flag transversal junto de outra área', () => {
    const r = classificar('Inteligência Artificial aplicada ao agronegócio')
    expect(r.ia).toBe(true)
    expect(r.areas).toContain('agro')
  })

  test('IA sozinha não vira área; sem outra área cai em geral', () => {
    const r = classificar('Edital de apoio a projetos de Machine Learning')
    expect(r.ia).toBe(true)
    expect(r.areas).toEqual(['geral'])
  })

  test('sem nenhum match cai em geral', () => {
    const r = classificar('Edital Complementar à Chamada Mobility CONFAP Italy 2026')
    expect(r.ia).toBe(false)
    expect(r.areas).toEqual(['geral'])
  })

  test('respeita fronteira de palavra: Bahia não é IA', () => {
    const r = classificar('Edital de apoio a projetos no estado da Bahia')
    expect(r.ia).toBe(false)
  })

  test('"IA" como palavra isolada conta', () => {
    const r = classificar('Bolsas para projetos de IA na indústria')
    expect(r.ia).toBe(true)
    expect(r.areas).toContain('industria')
  })

  test('termos com prefixo* casam variações', () => {
    const r = classificar('Apoio à inovação farmacêutica no país')
    expect(r.areas).toContain('saude')
  })

  test('"inovação" sozinha não é tecnologia — todo edital de fomento fala de inovação', () => {
    const r = classificar('Subvenção econômica à inovação para propostas inovadoras')
    expect(r.areas).toEqual(['geral'])
  })

  test('tecnologia continua casando termos específicos', () => {
    const r = classificar('Desenvolvimento de software e robótica educacional')
    expect(r.areas).toEqual(expect.arrayContaining(['tecnologia', 'educacao']))
  })

  test('sustentabilidade: adjetivo e colocação ambiental casam', () => {
    expect(classificar('Economia Circular e Cidades Sustentáveis').areas).toContain(
      'sustentabilidade',
    )
    expect(
      classificar('Programa de reciclagem e biodiversidade no Cerrado').areas,
    ).toContain('sustentabilidade')
  })

  test('"sustentabilidade econômica" não é a área sustentabilidade', () => {
    // Caso real: "Finep Mais Inovação Brasil – Rodada 2 - Base Industrial de
    // Defesa" fala de "Sustentabilidade econômica para BID" e era rotulado
    // como sustentabilidade ambiental.
    const r = classificar(
      'Base Industrial de Defesa — Sustentabilidade econômica para empresas do setor',
    )
    expect(r.areas).not.toContain('sustentabilidade')
  })

  test('ciência de dados na saúde: IA + saude', () => {
    const r = classificar('Edital de Ciência de Dados aplicada à Saúde')
    expect(r.ia).toBe(true)
    expect(r.areas).toContain('saude')
  })

  test('classifica múltiplas áreas', () => {
    const r = classificar('Energia solar para escolas rurais')
    expect(r.areas).toEqual(expect.arrayContaining(['energia', 'educacao', 'agro']))
  })
})
