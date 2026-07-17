import { createHash } from 'node:crypto'
import type { Fonte } from './schema'

export function gerarId(fonte: Fonte, url: string): string {
  const hash = createHash('sha1')
    .update(`${fonte}|${url}`)
    .digest('hex')
    .slice(0, 12)
  return `${fonte}-${hash}`
}

// "30/06/2026" ou "30/06/26" → ISO UTC. Com fimDoDia, marca 23:59:59 para o
// prazo valer o dia inteiro (o site anuncia só a data, sem hora).
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
  return `${ano}-${mes}-${dia}T${hora}Z`
}

export function fimDoDiaIso(iso: string): string {
  return `${iso.slice(0, 10)}T23:59:59.000Z`
}
