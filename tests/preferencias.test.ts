import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  CHAVE_AREAS,
  CHAVE_ULTIMA_VISITA,
  lerAreas,
  registrarVisita,
  salvarAreas,
} from '../lib/preferencias'

describe('preferências de área', () => {
  beforeEach(() => {
    // Extraído para uma const antes do stubGlobal: como o parâmetro é
    // `unknown`, o TS tenta tipar o `this` do objeto inline contra esse
    // contexto e o colapsa para `{}` — inlinear quebraria `tsc --noEmit`
    // mesmo com o comportamento em runtime intacto.
    const armazenamento = {
      dados: new Map<string, string>(),
      getItem(k: string) {
        return this.dados.get(k) ?? null
      },
      setItem(k: string, v: string) {
        this.dados.set(k, v)
      },
    }
    vi.stubGlobal('localStorage', armazenamento)
  })

  test('sem nada salvo devolve lista vazia', () => {
    expect(lerAreas()).toEqual([])
  })

  test('salva e lê de volta', () => {
    salvarAreas(['ia', 'saude'])
    expect(lerAreas()).toEqual(['ia', 'saude'])
  })

  test('ignora conteúdo corrompido em vez de quebrar a página', () => {
    localStorage.setItem(CHAVE_AREAS, 'não é json')
    expect(lerAreas()).toEqual([])
  })

  test('ignora json válido que não seja lista de strings', () => {
    localStorage.setItem(CHAVE_AREAS, '{"a":1}')
    expect(lerAreas()).toEqual([])
  })

  test('área que não existe mais é saneada e a lista limpa é persistida', () => {
    // Sem saneamento, a área fantasma vira filtro invisível: continua ativa
    // em filtrar() mas nenhum botão da barra aparece marcado.
    salvarAreas(['ia', 'saude', 'nanotecnologia'])
    expect(lerAreas(['ia', 'saude', 'agro'])).toEqual(['ia', 'saude'])
    expect(localStorage.getItem(CHAVE_AREAS)).toBe('["ia","saude"]')
  })

  test('sem lista de válidas, devolve como está (compatibilidade)', () => {
    salvarAreas(['qualquer'])
    expect(lerAreas()).toEqual(['qualquer'])
  })

  test('registrarVisita devolve a anterior e grava a atual', () => {
    expect(registrarVisita('2026-07-20T10:00:00.000Z')).toBeNull()
    expect(registrarVisita('2026-07-21T10:00:00.000Z')).toBe(
      '2026-07-20T10:00:00.000Z',
    )
    expect(localStorage.getItem(CHAVE_ULTIMA_VISITA)).toBe(
      '2026-07-21T10:00:00.000Z',
    )
  })
})
