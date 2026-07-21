import { createHash } from 'node:crypto'
import type { Fonte } from './schema'

export function gerarId(fonte: Fonte, url: string): string {
  const hash = createHash('sha1')
    .update(`${fonte}|${url}`)
    .digest('hex')
    .slice(0, 12)
  return `${fonte}-${hash}`
}

// "30/06/2026" ou "30/06/26" → ISO com offset de Brasília. As fontes anunciam
// datas do calendário local; gravar em UTC ("Z") fazia o prazo expirar às
// 20:59 de Brasília. O offset -03:00 faz o dia valer inteiro no fuso real.
export function dataBrParaIso(
  data: string,
  opts: { fimDoDia?: boolean } = {},
): string | undefined {
  const m = data.trim().match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (!m) return undefined
  const [, dia, mes, anoBruto] = m
  const ano = anoBruto.length === 2 ? String(2000 + Number(anoBruto)) : anoBruto
  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31)
    return undefined
  const hora = opts.fimDoDia ? '23:59:59.000' : '00:00:00.000'
  return `${ano}-${mes}-${dia}T${hora}-03:00`
}

export function fimDoDiaIso(iso: string): string {
  return `${iso.slice(0, 10)}T23:59:59.000-03:00`
}

// Trunca sem partir palavra e sinaliza o corte — descrição que termina em
// "na biod" mina a confiança em todo o resto do dado.
export function cortarEmPalavra(texto: string, max: number): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= max) return limpo
  const cortado = limpo.slice(0, max)
  const ultimoEspaco = cortado.lastIndexOf(' ')
  return `${(ultimoEspaco > 0 ? cortado.slice(0, ultimoEspaco) : cortado).replace(/[,.;:]$/, '')}…`
}
