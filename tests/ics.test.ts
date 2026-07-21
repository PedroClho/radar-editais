import { describe, expect, test } from 'vitest'
import { gerarIcs, urlIcs } from '../lib/ics'
import type { Edital } from '../scraper/schema'

function edital(over: Partial<Edital> = {}): Edital {
  return {
    id: 'cnpq-abc123',
    fonte: 'cnpq',
    titulo: 'Chamada CNPq nº 18/2026 - Avaliações em Saúde',
    url: 'https://exemplo.gov.br/chamada',
    situacao: 'aberto',
    areas: ['saude'],
    ia: false,
    coletadoEm: '2026-07-20T16:37:11.000Z',
    inscricaoFim: '2026-07-29T23:59:59.000-03:00',
    ...over,
  }
}

describe('gerarIcs', () => {
  const ics = gerarIcs(edital())!

  test('evento de dia inteiro na data do prazo, fim exclusivo no dia seguinte', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20260729')
    expect(ics).toContain('DTEND;VALUE=DATE:20260730')
  })

  test('UID estável e resumo com título limpo', () => {
    expect(ics).toContain('UID:cnpq-abc123@radar-editais')
    expect(ics).toContain('SUMMARY:Prazo: Avaliações em Saúde')
  })

  test('estrutura VCALENDAR com CRLF', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('BEGIN:VEVENT')
  })

  test('vira o mês corretamente no DTEND', () => {
    const fimDeMes = gerarIcs(
      edital({ inscricaoFim: '2026-07-31T23:59:59.000-03:00' }),
    )!
    expect(fimDeMes).toContain('DTEND;VALUE=DATE:20260801')
  })

  test('escapa vírgula e ponto-e-vírgula no texto', () => {
    const especial = gerarIcs(
      edital({ titulo: 'Edital A, B; C', inscricaoFim: '2026-08-01T23:59:59.000-03:00' }),
    )!
    expect(especial).toContain('SUMMARY:Prazo: Edital A\\, B\\; C')
  })

  test('sem prazo não há evento', () => {
    expect(gerarIcs(edital({ inscricaoFim: undefined }))).toBeUndefined()
    expect(urlIcs(edital({ inscricaoFim: undefined }))).toBeUndefined()
  })

  test('urlIcs devolve data URI de text/calendar', () => {
    expect(urlIcs(edital())).toMatch(/^data:text\/calendar;charset=utf-8,/)
  })
})
