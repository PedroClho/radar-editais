import { z } from 'zod'

export const FONTES = ['finep', 'cnpq', 'fapeg', 'capes'] as const
export type Fonte = (typeof FONTES)[number]

export const EditalSchema = z.object({
  id: z.string().min(1), // hash estável de fonte+url
  fonte: z.enum(FONTES),
  titulo: z.string().min(1),
  url: z.url(),
  descricao: z.string().optional(),
  inscricaoInicio: z.iso.datetime().optional(),
  inscricaoFim: z.iso.datetime().optional(), // ausente = "ver edital"
  situacao: z.enum(['aberto', 'encerrado', 'indefinido']),
  areas: z.array(z.string()).min(1),
  ia: z.boolean(),
  coletadoEm: z.iso.datetime(),
})
export type Edital = z.infer<typeof EditalSchema>

export const StatusFonteSchema = z.object({
  ok: z.boolean(),
  quantidade: z.number().int().nonnegative(),
  atualizadoEm: z.iso.datetime(), // última coleta BEM-SUCEDIDA desta fonte
  erro: z.string().optional(),
})
export type StatusFonte = z.infer<typeof StatusFonteSchema>

export const DadosSchema = z.object({
  atualizadoEm: z.iso.datetime(),
  fontes: z.record(z.enum(FONTES), StatusFonteSchema),
  editais: z.array(EditalSchema),
})
export type Dados = z.infer<typeof DadosSchema>
