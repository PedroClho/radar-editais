import { afterEach, describe, expect, test, vi } from 'vitest'
import { buscarJson, buscarTexto } from '../scraper/http'

function respostaOk(corpo: string): Response {
  return new Response(corpo, { status: 200 })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buscarTexto', () => {
  test('devolve o corpo no caminho feliz', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respostaOk('conteúdo')),
    )
    await expect(buscarTexto('https://x')).resolves.toBe('conteúdo')
  })

  test('tenta de novo após falha e sucede na segunda', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(respostaOk('agora foi'))
    vi.stubGlobal('fetch', fetchMock)
    // tentativas custam backoff real (2s×n) — zera para o teste ser rápido
    vi.stubGlobal('setTimeout', ((fn: () => void) => fn()) as never)
    await expect(buscarTexto('https://x')).resolves.toBe('agora foi')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('esgota as 3 tentativas e propaga o último erro', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('DNS')
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('setTimeout', ((fn: () => void) => fn()) as never)
    await expect(buscarTexto('https://x')).rejects.toThrow('DNS')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('HTTP não-2xx conta como falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('erro', { status: 503 })),
    )
    vi.stubGlobal('setTimeout', ((fn: () => void) => fn()) as never)
    await expect(buscarTexto('https://x', { tentativas: 1 })).rejects.toThrow(
      'HTTP 503',
    )
  })

  test('validar rejeita página de manutenção servida com HTTP 200', async () => {
    // Pegadinha real do gov.br: status 200 com página de manutenção no corpo.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respostaOk('<html>Em manutenção</html>')),
    )
    vi.stubGlobal('setTimeout', ((fn: () => void) => fn()) as never)
    await expect(
      buscarTexto('https://x', {
        tentativas: 1,
        validar: (corpo) => corpo.includes('planilhaview'),
      }),
    ).rejects.toThrow('conteúdo inesperado')
  })
})

describe('buscarJson', () => {
  test('faz o parse do corpo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respostaOk('{"items":[1,2]}')),
    )
    await expect(buscarJson('https://x')).resolves.toEqual({ items: [1, 2] })
  })
})
