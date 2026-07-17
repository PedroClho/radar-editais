import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { coletarCapes } from './fontes/capes'
import { coletarCnpq } from './fontes/cnpq'
import { coletarFapeg } from './fontes/fapeg'
import { coletarFinep } from './fontes/finep'
import { mesclar, type ResultadoFonte } from './mesclar'
import { DadosSchema, FONTES, type Dados, type Edital, type Fonte } from './schema'

const ARQUIVO_DADOS = join(__dirname, '..', 'data', 'editais.json')

const COLETORES: Record<Fonte, () => Promise<Edital[]>> = {
  finep: coletarFinep,
  cnpq: coletarCnpq,
  fapeg: coletarFapeg,
  capes: coletarCapes,
}

function lerAnterior(): Dados | undefined {
  if (!existsSync(ARQUIVO_DADOS)) return undefined
  const bruto = JSON.parse(readFileSync(ARQUIVO_DADOS, 'utf-8'))
  const parsed = DadosSchema.safeParse(bruto)
  return parsed.success ? parsed.data : undefined
}

async function main() {
  const agora = new Date().toISOString()
  const anterior = lerAnterior()

  const respostas = await Promise.allSettled(
    FONTES.map((fonte) => COLETORES[fonte]()),
  )
  const resultados = {} as Record<Fonte, ResultadoFonte>
  FONTES.forEach((fonte, i) => {
    const r = respostas[i]
    resultados[fonte] =
      r.status === 'fulfilled'
        ? { editais: r.value }
        : { erro: String(r.reason instanceof Error ? r.reason.message : r.reason) }
  })

  const dados = mesclar(resultados, anterior, agora)

  mkdirSync(dirname(ARQUIVO_DADOS), { recursive: true })
  writeFileSync(ARQUIVO_DADOS, `${JSON.stringify(dados, null, 2)}\n`)

  for (const fonte of FONTES) {
    const s = dados.fontes[fonte]
    console.log(
      s.ok
        ? `✔ ${fonte}: ${s.quantidade} editais`
        : `✖ ${fonte}: FALHOU (${s.erro}) — reusando ${s.quantidade} anteriores`,
    )
  }
  console.log(`Total: ${dados.editais.length} editais em ${ARQUIVO_DADOS}`)

  if (FONTES.every((f) => !dados.fontes[f].ok)) {
    console.error('Todas as fontes falharam.')
    process.exitCode = 1
  }
}

main()
