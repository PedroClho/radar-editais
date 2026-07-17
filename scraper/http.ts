const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// gov.br às vezes responde HTTP 200 com uma página de manutenção no lugar do
// conteúdo; o callback `validar` deixa cada fonte checar se veio a página certa.
export async function buscarTexto(
  url: string,
  opts: { validar?: (corpo: string) => boolean; tentativas?: number } = {},
): Promise<string> {
  const tentativas = opts.tentativas ?? 3
  let ultimoErro: unknown
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const resposta = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      })
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`)
      const corpo = await resposta.text()
      if (opts.validar && !opts.validar(corpo)) {
        throw new Error(`conteúdo inesperado (página de manutenção?) em ${url}`)
      }
      return corpo
    } catch (erro) {
      ultimoErro = erro
      if (tentativa < tentativas) {
        await new Promise((r) => setTimeout(r, 2_000 * tentativa))
      }
    }
  }
  throw ultimoErro
}

export async function buscarJson<T = unknown>(url: string): Promise<T> {
  return JSON.parse(await buscarTexto(url)) as T
}
