import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CHAVE_AREAS, lerAreas, salvarAreas } from '../lib/preferencias'

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
})
