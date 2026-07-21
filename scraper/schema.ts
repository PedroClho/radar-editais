import { z } from 'zod'

export const FONTES = ['finep', 'cnpq', 'fapeg', 'capes'] as const
export type Fonte = (typeof FONTES)[number]

// offset: true — datas de prazo carregam o fuso de Brasília (-03:00) para o
// dia valer inteiro no calendário local; dados antigos em "Z" seguem válidos.
const dataIso = z.iso.datetime({ offset: true })

export const EditalSchema = z.object({
  id: z.string().min(1), // hash estável de fonte+url
  fonte: z.enum(FONTES),
  titulo: z.string().min(1),
  url: z.url(),
  descricao: z.string().optional(),
  inscricaoInicio: dataIso.optional(),
  inscricaoFim: dataIso.optional(), // ausente = "ver edital"
  situacao: z.enum(['aberto', 'encerrado', 'indefinido']),
  areas: z.array(z.string()).min(1),
  ia: z.boolean(),
  // Primeira vez que o edital foi visto pelo radar (o merge preserva o valor
  // entre execuções) — é o que permite ordenar "sem prazo" por novidade e
  // marcar "novo" no front.
  coletadoEm: dataIso,
  // Público que pode submeter (só a FINEP entrega hoje: "Empresas", "ICTs"...)
  publicoAlvo: z.array(z.string()).optional(),
  // Edital sem prazo porque a submissão é contínua — exibido como
  // "fluxo contínuo" em vez de "prazo no edital".
  fluxoContinuo: z.boolean().optional(),
})
export type Edital = z.infer<typeof EditalSchema>

export const StatusFonteSchema = z.object({
  ok: z.boolean(),
  quantidade: z.number().int().nonnegative(),
  atualizadoEm: dataIso, // última coleta BEM-SUCEDIDA desta fonte
  erro: z.string().optional(),
})
export type StatusFonte = z.infer<typeof StatusFonteSchema>

export const DadosSchema = z.object({
  atualizadoEm: dataIso,
  fontes: z.record(z.enum(FONTES), StatusFonteSchema),
  editais: z.array(EditalSchema),
})
export type Dados = z.infer<typeof DadosSchema>
