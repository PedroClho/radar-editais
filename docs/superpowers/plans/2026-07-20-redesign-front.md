# Redesign do front — Implementation Plan

> **Concluído em 2026-07-20** — todas as tasks implementadas nos commits
> `95e4e58..c31dc79` (os checkboxes abaixo não foram marcados durante a
> execução; confira o git log, não este arquivo).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o dashboard atual por uma agenda de prazos onde a data é a espinha vertical da página, e corrigir os dados de prazo que a sustentam.

**Architecture:** Toda a lógica de texto e data vira função pura em `lib/editais.ts`, testada offline — espelhando a convenção que o scraper já usa. O componente único de 378 linhas é quebrado em componentes pequenos. Duas correções no scraper elevam a cobertura de prazo de 15 para ~35 editais.

**Tech Stack:** Next.js 16.2.10 (App Router, SSG), React 19.2.4, Tailwind v4 (tokens em CSS, sem arquivo de config), Vitest 4, Zod 4, cheerio.

## Global Constraints

- Commits em PT-BR, autor `Pedro Coelho <coelho@discente.ufg.br>`, **sem** `Co-Authored-By`.
- Todo texto de UI em PT-BR.
- Datas sempre ISO no JSON; exibição em pt-BR no front.
- Fuso de referência para cálculo de dias: `America/Sao_Paulo`, sempre via `Intl` com `timeZone` explícito. **Nunca** usar `getDate()`/`getFullYear()` locais em lógica compartilhada entre servidor e cliente — o servidor de build roda em UTC e o navegador em BRT; isso quebra a hidratação.
- Testes ficam em `tests/**/*.test.ts` (é o único `include` do `vitest.config.ts`).
- Import path alias: `@/*` → raiz do projeto.
- Sem novas dependências de UI. A única dependência nova permitida no plano é `pdf-parse` (Task 8).
- Antes de escrever componentes, consultar `node_modules/next/dist/docs/` conforme `AGENTS.md`.
- A arquitetura de fallback do scraper é intocável: fonte que falha reusa dados anteriores e é marcada `ok: false`. Nunca apagar dados.

## Verificado nas docs do Next 16.2.10

Consultado em `node_modules/next/dist/docs/` antes de escrever o plano, conforme `AGENTS.md`:

- **`next/font/google` não mudou.** `01-app/03-api-reference/02-components/font.md` — a API é a mesma e `variable` continua criando a CSS custom property. Fonte variável **dispensa `weight`**: comentário literal na doc, "If loading a variable font, you don't need to specify the font weight". `Newsreader` é variável ⇒ omitir `weight` (Task 4).
- **SSG continua automático.** O projeto não habilita `cacheComponents` no `next.config.ts`, então vale o modelo de `02-guides/caching-without-cache-components.md`, onde `dynamic` é `'auto'`. Um `page.tsx` com `import` estático de JSON e sem Request-time API (`cookies()`, `headers()`, `searchParams`) é prerenderizado. **Não** acrescentar `export const dynamic = 'force-static'`.
- **`'use client'` e `metadata` inalterados.** As diretivas novas (`use cache`, `use cache: private`, `use cache: remote`) exigem `cacheComponents` e operam sobre funções `async` no servidor — não têm relação com um Client Component usando `useState`/`useEffect`.
- **Hidratação — decisão consciente.** `02-guides/preventing-flash-before-hydration.md` recomenda, para `localStorage`, script inline + inicializador lazy do `useState`, e critica `useEffect` ("o usuário vê o valor do servidor primeiro, depois a correção"). **Não seguimos essa recomendação para as áreas**, e o motivo é que ela não se aplica: o padrão do script inline funciona quando o valor persistido vira um *atributo* do DOM (tema), que o script consegue aplicar antes do paint. Aqui o valor decide *quais itens da lista existem* — nenhum script inline pré-renderiza isso, e um inicializador lazy faria o cliente renderizar uma lista diferente do HTML estático, ou seja, mismatch de verdade. Com `useEffect`, servidor e cliente começam iguais (`areas: []`, lista completa) e o filtro apenas estreita depois do mount. Para o relógio, a mesma doc já indica `useEffect` explicitamente: "Date updates live (countdown timers, clocks) | Use a Client Component with `useEffect`".
- **`agoraMs` no primeiro render usa `dados.atualizadoEm`**, que é idêntico no servidor e no cliente — por isso a contagem de dias não precisa de `suppressHydrationWarning`.

---

### Task 1: Corrigir o campo de prazo da FINEP

O coletor lê `vigenciaFim` (6 de 36 registros). O campo correto é `prazoProposto` (22 de 36) — é o que a página do edital mostra como "Prazo para envio de propostas até:". Onde os dois existem, `vigenciaFim` é mais tardio: o edital BRICs mostra hoje 19/11 quando o prazo real é 14/08.

**Files:**
- Modify: `scraper/fontes/finep.ts:12-24` (schema Zod) e `:58` (mapeamento)
- Test: `tests/fontes.test.ts`

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: `parseFinep(resposta: unknown, agora: string): Edital[]` — assinatura inalterada; muda só o valor de `inscricaoFim`

- [ ] **Step 1: Escrever os testes que falham**

A fixture `tests/fixtures/finep-abertas.json` já contém todos os casos. Acrescentar em `tests/fontes.test.ts`, dentro do `describe` da FINEP que já existe:

```ts
test('usa prazoProposto em vez de vigenciaFim quando os dois divergem', () => {
  const editais = parseFinep(fixtureFinep, AGORA)
  // id 991625 — "BRICs - CHAMADA PÚBLICA Cooperação Multilateral"
  // prazoProposto 2026-08-14, vigenciaFim 2026-11-19
  const brics = editais.find((e) => e.url.endsWith('/991625'))
  expect(brics).toBeDefined()
  expect(brics!.inscricaoFim).toBe('2026-08-14T23:59:59.000Z')
})

test('aproveita prazoProposto quando não há vigenciaFim', () => {
  const editais = parseFinep(fixtureFinep, AGORA)
  // id 968467 — "DESAFIO TECNOLÓGICO ELETROLISADOR NACIONAL"
  const desafio = editais.find((e) => e.url.endsWith('/968467'))
  expect(desafio).toBeDefined()
  expect(desafio!.inscricaoFim).toBe('2026-09-21T23:59:59.000Z')
})

test('fica sem prazo quando a origem não tem nenhuma das duas datas', () => {
  const editais = parseFinep(fixtureFinep, AGORA)
  // id 719676 — "Chamada Pública Bilateral Finep-CDTI"
  const bilateral = editais.find((e) => e.url.endsWith('/719676'))
  expect(bilateral).toBeDefined()
  expect(bilateral!.inscricaoFim).toBeUndefined()
})

test('a cobertura de prazo sobe de 6 para 22 editais', () => {
  const editais = parseFinep(fixtureFinep, AGORA)
  expect(editais.filter((e) => e.inscricaoFim).length).toBe(22)
})
```

Se `AGORA` e `fixtureFinep` ainda não existirem nesse arquivo, usar os nomes já em uso no `describe` da FINEP — conferir o topo de `tests/fontes.test.ts` antes de colar.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/fontes.test.ts`
Expected: FAIL. O primeiro teste deve reportar `2026-11-19T23:59:59.000Z` no lugar de `2026-08-14T23:59:59.000Z`; o da cobertura deve reportar `6` no lugar de `22`.

- [ ] **Step 3: Implementar**

Em `scraper/fontes/finep.ts`, adicionar o campo ao schema (logo depois de `vigenciaFim`, linha 19):

```ts
  vigenciaFim: z.string().nullish(),
  // Prazo real de envio de propostas — é o que a página do edital exibe.
  // `vigenciaFim` é a vigência do instrumento e chega a ser 3 meses mais
  // tarde; usar ela fazia o site anunciar folga que não existe.
  prazoProposto: z.string().nullish(),
```

E trocar o mapeamento na linha 58:

```ts
      inscricaoFim: (() => {
        const prazo = dado.prazoProposto ?? dado.vigenciaFim
        return prazo ? fimDoDiaIso(prazo) : undefined
      })(),
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/fontes.test.ts`
Expected: PASS, todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add scraper/fontes/finep.ts tests/fontes.test.ts
git commit -m "fix: FINEP usa prazoProposto como prazo de inscrição

vigenciaFim é a vigência do instrumento, não o prazo de envio de
propostas — chega a ser 3 meses mais tarde. Cobertura de prazo na
FINEP sobe de 6 para 22 dos 36 editais."
```

---

### Task 2: Funções puras de texto

Os títulos vêm afogados em prefixo burocrático e boa parte do conteúdo da FINEP vem em CAIXA ALTA. Três funções puras resolvem isso, testáveis offline.

**Files:**
- Create: `lib/editais.ts`
- Test: `tests/editais.test.ts`

**Interfaces:**
- Consumes: `Edital` de `@/scraper/schema`
- Produces:
  - `limparTitulo(titulo: string): { titulo: string; referencia?: string }`
  - `normalizarCaixa(texto: string, modo?: 'titulo' | 'frase'): string`
  - `resumir(texto: string, max?: number): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/editais.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { limparTitulo, normalizarCaixa, resumir } from '../lib/editais'

describe('limparTitulo', () => {
  test('separa o prefixo burocrático do CNPq do assunto', () => {
    const r = limparTitulo(
      'Chamada CNPq/Decit-SCTIE-MS Nº 18/2026 - Avaliações de Políticas, Programas, Projetos e Ações em Saúde',
    )
    expect(r.titulo).toBe(
      'Avaliações de Políticas, Programas, Projetos e Ações em Saúde',
    )
    expect(r.referencia).toBe('CNPq/Decit-SCTIE-MS nº 18/2026')
  })

  test('aceita "Chamada Pública" e o sinal de grau no lugar do ordinal', () => {
    const r = limparTitulo(
      'Chamada Pública CNPq N° 07/2026 - Programa Institucional de Bolsas de Pós-Graduação (PIBPG)',
    )
    expect(r.titulo).toBe(
      'Programa Institucional de Bolsas de Pós-Graduação (PIBPG)',
    )
    expect(r.referencia).toBe('CNPq nº 07/2026')
  })

  test('aceita travessão no lugar do hífen', () => {
    const r = limparTitulo('Chamada CNPq/FNDCT nº 06/2026 – UNIVERSAL')
    expect(r.titulo).toBe('UNIVERSAL')
    expect(r.referencia).toBe('CNPq/FNDCT nº 06/2026')
  })

  test('devolve intacto quando o padrão não casa — nunca perde informação', () => {
    const original = 'CARTA CONVITE MCTI/FINEP - PROGRAMA TECNOVA 2026/2027'
    expect(limparTitulo(original)).toEqual({ titulo: original })

    const outro = 'Agricultura familiar para ICTs 2026'
    expect(limparTitulo(outro)).toEqual({ titulo: outro })
  })

  test('não corta quando sobraria um título vazio', () => {
    const so = 'Chamada CNPq nº 06/2026 - '
    expect(limparTitulo(so).titulo).toBe(so)
  })
})

describe('normalizarCaixa', () => {
  test('desliga o CAIXA ALTA preservando siglas, em modo título', () => {
    expect(
      normalizarCaixa('CARTA CONVITE MCTI/FINEP - PROGRAMA TECNOVA 2026/2027'),
    ).toBe('Carta Convite MCTI/FINEP - Programa Tecnova 2026/2027')
  })

  test('em modo frase usa caixa de sentença, para descrições', () => {
    expect(
      normalizarCaixa(
        'SELEÇÃO PÚBLICA DE PROPOSTAS DOS AGENTES OPERACIONAIS',
        'frase',
      ),
    ).toBe('Seleção pública de propostas dos agentes operacionais')
  })

  test('deixa em paz texto que já está em caixa mista', () => {
    const ok = 'Programa Institucional de Bolsas de Pós-Graduação (PIBPG)'
    expect(normalizarCaixa(ok)).toBe(ok)
  })

  test('preserva números e siglas curtas', () => {
    expect(normalizarCaixa('DESAFIO TECNOLÓGICO ELETROLISADOR NACIONAL')).toBe(
      'Desafio Tecnológico Eletrolisador Nacional',
    )
  })
})

describe('resumir', () => {
  test('colapsa espaços repetidos e corta em limite de palavra', () => {
    const r = resumir('REAIS    Selecionar propostas de Agentes', 20)
    expect(r).toBe('REAIS Selecionar…')
    expect(r.length).toBeLessThanOrEqual(21)
  })

  test('não mexe em texto que já cabe', () => {
    expect(resumir('Texto curto', 100)).toBe('Texto curto')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/editais.test.ts`
Expected: FAIL — "Failed to resolve import ../lib/editais".

- [ ] **Step 3: Implementar**

Criar `lib/editais.ts`:

```ts
// Prefixo burocrático das chamadas: "Chamada [Pública] <órgão> nº 12/2026 - ".
// O assunto real vem depois do hífen; o número vira linha secundária.
const RE_CHAMADA =
  /^chamada\s+(?:p[úu]blica\s+)?(\S+?)\s+n[ºo°]\s*(\d{1,3}\/\d{4})\s*[-–—]\s*(.+)$/i

export function limparTitulo(titulo: string): {
  titulo: string
  referencia?: string
} {
  const m = titulo.trim().match(RE_CHAMADA)
  if (!m) return { titulo }
  const [, orgao, numero, resto] = m
  const assunto = resto.trim()
  // Sem assunto sobrando, cortar só destruiria informação.
  if (!assunto) return { titulo }
  return { titulo: assunto, referencia: `${orgao} nº ${numero}` }
}

// Siglas que sobrevivem à normalização mesmo tendo mais de 5 letras.
const SIGLAS = new Set([
  'MMULHERES',
  'EMBRAPII',
  'SEBRAE',
  'FAPESP',
  'FAPEMIG',
])

const ATONAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'por', 'com', 'a', 'o', 'as', 'os', 'ao', 'aos', 'à', 'às',
  'um', 'uma', 'que', 'the',
])

function ehSigla(token: string): boolean {
  const limpo = token.replace(/[^\p{L}]/gu, '')
  if (!limpo) return true // pontuação/números passam intactos
  if (SIGLAS.has(limpo)) return true
  return limpo === limpo.toUpperCase() && limpo.length <= 5
}

function capitalizar(palavra: string): string {
  return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase()
}

// Só age em texto predominantemente maiúsculo — a FINEP entrega título e
// descrição gritando. Texto já em caixa mista passa intacto.
export function normalizarCaixa(
  texto: string,
  modo: 'titulo' | 'frase' = 'titulo',
): string {
  const letras = texto.match(/\p{L}/gu) ?? []
  if (letras.length < 8) return texto
  const maiusculas = letras.filter((c) => c === c.toUpperCase()).length
  if (maiusculas / letras.length < 0.7) return texto

  const palavras = texto.split(/(\s+)/)
  let primeiraFeita = false

  return palavras
    .map((token) => {
      if (/^\s+$/.test(token)) return token
      // "MCTI/FINEP" precisa ser resolvido pedaço a pedaço.
      const partes = token.split('/').map((parte) => {
        if (/\d/.test(parte)) return parte
        if (ehSigla(parte)) return parte
        const minuscula = parte.toLowerCase()
        if (modo === 'frase') return minuscula
        if (primeiraFeita && ATONAS.has(minuscula)) return minuscula
        return capitalizar(parte)
      })
      const resultado = partes.join('/')
      if (/\p{L}/u.test(token)) primeiraFeita = true
      return resultado
    })
    .join('')
    .replace(/^(\P{L}*)(\p{L})/u, (_, antes, letra) => antes + letra.toUpperCase())
}

export function resumir(texto: string, max = 180): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= max) return limpo
  const cortado = limpo.slice(0, max)
  const ultimoEspaco = cortado.lastIndexOf(' ')
  return `${(ultimoEspaco > 0 ? cortado.slice(0, ultimoEspaco) : cortado).replace(/[,.;:]$/, '')}…`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/editais.test.ts`
Expected: PASS, 11 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/editais.ts tests/editais.test.ts
git commit -m "feat: funções puras para limpar título e caixa dos editais"
```

---

### Task 3: Funções puras de data e agrupamento

**Files:**
- Modify: `lib/editais.ts` (acrescentar ao final)
- Test: `tests/editais.test.ts` (acrescentar ao final)

**Interfaces:**
- Consumes: `Edital` de `@/scraper/schema`
- Produces:
  - `diasAte(fimIso: string, agoraMs: number): number`
  - `nivelUrgencia(dias: number | null): 'critico' | 'proximo' | 'neutro'`
  - `type Grupos = { estaSemana: Edital[]; proximasSemanas: Edital[]; maisAdiante: Edital[]; semPrazo: Edital[] }`
  - `agruparPorPrazo(editais: Edital[], agoraMs: number): Grupos`
  - `filtrar(editais: Edital[], f: { busca: string; fonte: Fonte | null; areas: string[] }): Edital[]`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar em `tests/editais.test.ts`:

```ts
import { agruparPorPrazo, diasAte, filtrar, nivelUrgencia } from '../lib/editais'
import type { Edital } from '../scraper/schema'

const AGORA = Date.parse('2026-07-20T12:00:00.000Z')

function edital(over: Partial<Edital> = {}): Edital {
  return {
    id: 'x',
    fonte: 'cnpq',
    titulo: 'Título',
    url: 'https://exemplo.br/a',
    situacao: 'aberto',
    areas: ['geral'],
    ia: false,
    coletadoEm: '2026-07-20T00:00:00.000Z',
    ...over,
  }
}

describe('diasAte', () => {
  test('conta dias de calendário no fuso de São Paulo', () => {
    expect(diasAte('2026-07-29T23:59:59.000Z', AGORA)).toBe(9)
  })

  test('o último dia é zero, não um', () => {
    expect(diasAte('2026-07-20T23:59:59.000Z', AGORA)).toBe(0)
  })

  test('prazo vencido é negativo', () => {
    expect(diasAte('2026-07-18T23:59:59.000Z', AGORA)).toBe(-2)
  })
})

describe('nivelUrgencia', () => {
  test('respeita os limites exatos das faixas', () => {
    expect(nivelUrgencia(0)).toBe('critico')
    expect(nivelUrgencia(3)).toBe('critico')
    expect(nivelUrgencia(4)).toBe('proximo')
    expect(nivelUrgencia(14)).toBe('proximo')
    expect(nivelUrgencia(15)).toBe('neutro')
  })

  test('sem prazo é neutro', () => {
    expect(nivelUrgencia(null)).toBe('neutro')
  })
})

describe('agruparPorPrazo', () => {
  test('distribui pelos quatro grupos', () => {
    const g = agruparPorPrazo(
      [
        edital({ id: 'a', inscricaoFim: '2026-07-25T23:59:59.000Z' }), // 5d
        edital({ id: 'b', inscricaoFim: '2026-08-10T23:59:59.000Z' }), // 21d
        edital({ id: 'c', inscricaoFim: '2026-12-01T23:59:59.000Z' }), // >30d
        edital({ id: 'd' }), // sem prazo
      ],
      AGORA,
    )
    expect(g.estaSemana.map((e) => e.id)).toEqual(['a'])
    expect(g.proximasSemanas.map((e) => e.id)).toEqual(['b'])
    expect(g.maisAdiante.map((e) => e.id)).toEqual(['c'])
    expect(g.semPrazo.map((e) => e.id)).toEqual(['d'])
  })

  test('descarta prazo vencido mesmo com situação "aberto" na origem', () => {
    // 6 editais da FINEP chegam assim: situacao aberta, prazo no passado.
    const g = agruparPorPrazo(
      [edital({ id: 'velho', inscricaoFim: '2026-05-28T23:59:59.000Z' })],
      AGORA,
    )
    expect(g.estaSemana).toHaveLength(0)
    expect(g.proximasSemanas).toHaveLength(0)
    expect(g.maisAdiante).toHaveLength(0)
    expect(g.semPrazo).toHaveLength(0)
  })

  test('descarta encerrado declarado pela fonte', () => {
    const g = agruparPorPrazo([edital({ situacao: 'encerrado' })], AGORA)
    expect(g.semPrazo).toHaveLength(0)
  })

  test('ordena por prazo crescente dentro do grupo', () => {
    const g = agruparPorPrazo(
      [
        edital({ id: 'depois', inscricaoFim: '2026-07-26T23:59:59.000Z' }),
        edital({ id: 'antes', inscricaoFim: '2026-07-22T23:59:59.000Z' }),
      ],
      AGORA,
    )
    expect(g.estaSemana.map((e) => e.id)).toEqual(['antes', 'depois'])
  })

  test('sem prazo vem do mais recentemente coletado para o mais antigo', () => {
    const g = agruparPorPrazo(
      [
        edital({ id: 'antigo', coletadoEm: '2026-07-01T00:00:00.000Z' }),
        edital({ id: 'novo', coletadoEm: '2026-07-19T00:00:00.000Z' }),
      ],
      AGORA,
    )
    expect(g.semPrazo.map((e) => e.id)).toEqual(['novo', 'antigo'])
  })
})

describe('filtrar', () => {
  const lista = [
    edital({ id: 'saude', areas: ['saude'], titulo: 'Endometriose' }),
    edital({ id: 'agro', areas: ['agro'], fonte: 'finep', titulo: 'Milho' }),
  ]

  test('sem filtro devolve tudo', () => {
    expect(filtrar(lista, { busca: '', fonte: null, areas: [] })).toHaveLength(2)
  })

  test('busca ignora acento e caixa', () => {
    const r = filtrar(lista, { busca: 'ENDOMETRIOSE', fonte: null, areas: [] })
    expect(r.map((e) => e.id)).toEqual(['saude'])
  })

  test('áreas funcionam como OU', () => {
    const r = filtrar(lista, { busca: '', fonte: null, areas: ['saude', 'agro'] })
    expect(r).toHaveLength(2)
  })

  test('fonte e área se combinam como E', () => {
    const r = filtrar(lista, { busca: '', fonte: 'finep', areas: ['saude'] })
    expect(r).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/editais.test.ts`
Expected: FAIL — `diasAte`, `nivelUrgencia`, `agruparPorPrazo`, `filtrar` não exportados.

- [ ] **Step 3: Implementar**

Acrescentar ao final de `lib/editais.ts`:

```ts
import { normalizar } from '@/scraper/classificador'
import type { Edital, Fonte } from '@/scraper/schema'

const FUSO = 'America/Sao_Paulo'
const DIA_MS = 86_400_000

const FMT_DIA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

// Índice do dia de calendário em São Paulo. Passa por Intl de propósito:
// o build roda em UTC e o navegador em BRT, e getDate() local daria
// resultados diferentes nos dois — quebrando a hidratação.
function diaCalendario(ms: number): number {
  const [dia, mes, ano] = FMT_DIA.format(new Date(ms)).split('/').map(Number)
  return Date.UTC(ano, mes - 1, dia) / DIA_MS
}

export function diasAte(fimIso: string, agoraMs: number): number {
  return diaCalendario(new Date(fimIso).getTime()) - diaCalendario(agoraMs)
}

export type Urgencia = 'critico' | 'proximo' | 'neutro'

export function nivelUrgencia(dias: number | null): Urgencia {
  if (dias === null) return 'neutro'
  if (dias <= 3) return 'critico'
  if (dias <= 14) return 'proximo'
  return 'neutro'
}

export type Grupos = {
  estaSemana: Edital[]
  proximasSemanas: Edital[]
  maisAdiante: Edital[]
  semPrazo: Edital[]
}

export function agruparPorPrazo(editais: Edital[], agoraMs: number): Grupos {
  const g: Grupos = {
    estaSemana: [],
    proximasSemanas: [],
    maisAdiante: [],
    semPrazo: [],
  }
  for (const e of editais) {
    if (e.situacao === 'encerrado') continue
    if (!e.inscricaoFim) {
      g.semPrazo.push(e)
      continue
    }
    const dias = diasAte(e.inscricaoFim, agoraMs)
    // A situação vinda da fonte não é confiável: a FINEP entrega editais
    // marcados "aberta" com prazo meses no passado. O prazo manda.
    if (dias < 0) continue
    if (dias <= 7) g.estaSemana.push(e)
    else if (dias <= 30) g.proximasSemanas.push(e)
    else g.maisAdiante.push(e)
  }
  const porPrazo = (a: Edital, b: Edital) =>
    (a.inscricaoFim ?? '').localeCompare(b.inscricaoFim ?? '')
  g.estaSemana.sort(porPrazo)
  g.proximasSemanas.sort(porPrazo)
  g.maisAdiante.sort(porPrazo)
  g.semPrazo.sort((a, b) => b.coletadoEm.localeCompare(a.coletadoEm))
  return g
}

export function filtrar(
  editais: Edital[],
  f: { busca: string; fonte: Fonte | null; areas: string[] },
): Edital[] {
  const termo = normalizar(f.busca.trim())
  return editais.filter(
    (e) =>
      (!f.fonte || e.fonte === f.fonte) &&
      (f.areas.length === 0 || f.areas.some((a) => e.areas.includes(a))) &&
      (!termo ||
        normalizar(`${e.titulo} ${e.descricao ?? ''}`).includes(termo)),
  )
}
```

Mover os `import` para o topo do arquivo, junto dos que já existirem.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run`
Expected: PASS em todos os arquivos — os 32 testes que já existiam mais os novos.

- [ ] **Step 5: Commit**

```bash
git add lib/editais.ts tests/editais.test.ts
git commit -m "feat: agrupamento por prazo, escala de urgência e filtros puros"
```

---

### Task 4: Tipografia e tokens de cor

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: CSS vars `--font-newsreader`, `--font-archivo`, `--critico`; classe utilitária `.serif`

**Antes de começar:** ler `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` (ou o caminho equivalente de `next/font` na árvore de docs) e confirmar a forma correta de declarar uma fonte variável. `Newsreader` é variable font: se a doc disser que fontes variáveis dispensam `weight`, omitir; se exigir, passar a faixa.

- [ ] **Step 1: Trocar as fontes no layout**

Em `app/layout.tsx`, substituir o bloco de fontes. `IBM_Plex_Mono` sai inteiro — o microlabel monospace maiúsculo era a principal assinatura visual de "gerado por IA", e o alinhamento de números passa a vir de `tabular-nums`.

```tsx
import type { Metadata } from 'next'
import { Archivo, Newsreader } from 'next/font/google'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
})

// Serifada nos títulos: edital é documento, e a voz editorial é o oposto
// do sans genérico que todo dashboard gerado por IA usa.
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
})

export const metadata: Metadata = {
  title: 'Radar de Editais — fomento à pesquisa e inovação',
  description:
    'Editais de fomento abertos agora (FINEP, CNPq, FAPEG, CAPES), rotulados por área e com destaque para IA. Atualizado diariamente.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${newsreader.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Atualizar os tokens**

Em `app/globals.css`, trocar a classe `.dados` (que aplicava monospace) por `.serif` e `.numeros`, e acrescentar `--critico`. `--accent-suave` sai: é token órfão, definido e nunca referenciado.

```css
@import 'tailwindcss';

:root {
  --bg: #fbfbfa;
  --surface: #ffffff;
  --ink: #17181c;
  --muted: #6a6e75;
  --line: #e4e5e1;
  --accent: #a86f00;
  --accent-forte: #7d5300;
  --critico: #9a3412;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121316;
    --surface: #1a1c20;
    --ink: #ecedef;
    --muted: #9a9ea6;
    --line: #2a2d33;
    --accent: #f0b429;
    --accent-forte: #f8ce6b;
    --critico: #f98a6a;
  }
}

html {
  font-family: var(--font-archivo), system-ui, sans-serif;
}

body {
  background: var(--bg);
  color: var(--ink);
}

.serif {
  font-family: var(--font-newsreader), Georgia, serif;
}

/* Alinha os dígitos entre linhas sem precisar de fonte monoespaçada. */
.numeros {
  font-variant-numeric: tabular-nums;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 3: Confirmar que compila**

Run: `npx next build`
Expected: build verde. `/` continua marcada `○ (Static)`.

Nesta etapa o site ainda usa `Dashboard.tsx`, que referencia a classe `.dados` — agora inexistente. O texto perde o monospace mas nada quebra; `Dashboard.tsx` é removido na Task 7.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: tipografia serifada nos títulos, remove monospace e token órfão"
```

---

### Task 5: A linha do edital com espinha de data

O componente central. A data sai da direita e vira o eixo vertical à esquerda; título e descrição penduram nela. Um foco por linha.

**Files:**
- Create: `componentes/LinhaEdital.tsx`
- Create: `componentes/GrupoPrazo.tsx`

**Interfaces:**
- Consumes: `limparTitulo`, `normalizarCaixa`, `resumir`, `diasAte`, `nivelUrgencia` de `@/lib/editais`; `ROTULOS` de `@/scraper/classificador`
- Produces:
  - `<LinhaEdital edital={Edital} agoraMs={number} />`
  - `<GrupoPrazo titulo={string} editais={Edital[]} agoraMs={number} />` — devolve `null` se a lista estiver vazia

- [ ] **Step 1: Criar `componentes/LinhaEdital.tsx`**

```tsx
import {
  diasAte,
  limparTitulo,
  nivelUrgencia,
  normalizarCaixa,
  resumir,
} from '@/lib/editais'
import { ROTULOS } from '@/scraper/classificador'
import type { Edital, Fonte } from '@/scraper/schema'

const NOMES_FONTES: Record<Fonte, string> = {
  finep: 'FINEP',
  cnpq: 'CNPq',
  fapeg: 'FAPEG',
  capes: 'CAPES',
}

const FUSO = 'America/Sao_Paulo'

const FMT_DIA_MES = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: 'short',
})

const FMT_SEMANA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'short',
})

const COR_URGENCIA = {
  critico: 'text-[var(--critico)]',
  proximo: 'text-[var(--accent-forte)]',
  neutro: 'text-[var(--ink)]',
} as const

function contagem(dias: number): string {
  if (dias === 0) return 'último dia'
  if (dias === 1) return 'falta 1 dia'
  return `faltam ${dias} dias`
}

export default function LinhaEdital({
  edital,
  agoraMs,
}: {
  edital: Edital
  agoraMs: number
}) {
  const dias = edital.inscricaoFim
    ? diasAte(edital.inscricaoFim, agoraMs)
    : null
  const urgencia = nivelUrgencia(dias)
  const { titulo, referencia } = limparTitulo(edital.titulo)
  const areas = edital.areas.filter((a) => a !== 'geral')

  return (
    <li>
      <a
        href={edital.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group grid grid-cols-[3.5rem_1fr] gap-x-4 border-b border-[var(--line)] py-5 sm:grid-cols-[4.5rem_1fr] sm:gap-x-6"
      >
        <div className="numeros pt-0.5 text-right">
          {edital.inscricaoFim ? (
            <>
              <span className="block text-[11px] text-[var(--muted)] lowercase">
                {FMT_SEMANA.format(new Date(edital.inscricaoFim)).replace('.', '')}
              </span>
              <span
                className={`block text-[15px] font-medium ${COR_URGENCIA[urgencia]}`}
              >
                {FMT_DIA_MES.format(new Date(edital.inscricaoFim)).replace('.', '')}
              </span>
            </>
          ) : (
            <span aria-hidden className="block text-[15px] text-[var(--line)]">
              —
            </span>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="serif text-[17px] leading-snug text-pretty decoration-[var(--line)] underline-offset-4 group-hover:underline">
            {normalizarCaixa(titulo)}
          </h3>

          {edital.descricao && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
              {normalizarCaixa(resumir(edital.descricao), 'frase')}
            </p>
          )}

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
            <span>{NOMES_FONTES[edital.fonte]}</span>
            {edital.ia && (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium text-[var(--ink)]">IA</span>
              </>
            )}
            {areas.map((a) => (
              <span key={a} className="contents">
                <span aria-hidden>·</span>
                <span>{ROTULOS[a] ?? a}</span>
              </span>
            ))}
            {referencia && (
              <>
                <span aria-hidden>·</span>
                <span className="numeros">{referencia}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className={dias !== null ? COR_URGENCIA[urgencia] : undefined}>
              {dias === null ? 'prazo no edital' : contagem(dias)}
            </span>
          </p>
        </div>
      </a>
    </li>
  )
}
```

- [ ] **Step 2: Criar `componentes/GrupoPrazo.tsx`**

```tsx
import type { Edital } from '@/scraper/schema'
import LinhaEdital from './LinhaEdital'

export default function GrupoPrazo({
  titulo,
  editais,
  agoraMs,
}: {
  titulo: string
  editais: Edital[]
  agoraMs: number
}) {
  if (editais.length === 0) return null
  return (
    <section className="mt-12 first:mt-8">
      <h2 className="flex items-baseline gap-3 text-xs tracking-wider text-[var(--muted)] uppercase">
        {titulo}
        <span className="numeros text-[var(--line)]">{editais.length}</span>
      </h2>
      <ul className="mt-3 border-t border-[var(--line)]">
        {editais.map((e) => (
          <LinhaEdital key={e.id} edital={e} agoraMs={agoraMs} />
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: Confirmar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros. Os componentes ainda não são usados por ninguém — a montagem é a Task 7.

- [ ] **Step 4: Commit**

```bash
git add componentes/LinhaEdital.tsx componentes/GrupoPrazo.tsx
git commit -m "feat: linha de edital com espinha de data e grupo por prazo"
```

---

### Task 6: Controles com personalização persistida

Substitui a parede de 13 chips por três controles. A escolha de áreas é ao mesmo tempo filtro e preferência salva.

**Files:**
- Create: `componentes/Controles.tsx`
- Create: `lib/preferencias.ts`
- Test: `tests/preferencias.test.ts`

**Interfaces:**
- Produces:
  - `lerAreas(): string[]` e `salvarAreas(areas: string[]): void` em `lib/preferencias.ts`
  - `<Controles busca fonte areas areasDisponiveis onBusca onFonte onAreas />`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/preferencias.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CHAVE_AREAS, lerAreas, salvarAreas } from '../lib/preferencias'

describe('preferências de área', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      dados: new Map<string, string>(),
      getItem(k: string) {
        return this.dados.get(k) ?? null
      },
      setItem(k: string, v: string) {
        this.dados.set(k, v)
      },
    })
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/preferencias.test.ts`
Expected: FAIL — "Failed to resolve import ../lib/preferencias".

- [ ] **Step 3: Implementar `lib/preferencias.ts`**

```ts
export const CHAVE_AREAS = 'radar:areas'

// Nunca deixar preferência corrompida derrubar a página: no pior caso
// o usuário volta a ver tudo, que é o estado de primeira visita.
export function lerAreas(): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE_AREAS)
    if (!bruto) return []
    const valor: unknown = JSON.parse(bruto)
    if (!Array.isArray(valor)) return []
    return valor.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

export function salvarAreas(areas: string[]): void {
  try {
    localStorage.setItem(CHAVE_AREAS, JSON.stringify(areas))
  } catch {
    // Modo privativo ou storage cheio: seguir sem persistir.
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/preferencias.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Criar `componentes/Controles.tsx`**

```tsx
'use client'

import { ROTULOS } from '@/scraper/classificador'
import type { Fonte } from '@/scraper/schema'

const FONTES: Fonte[] = ['finep', 'cnpq', 'fapeg', 'capes']
const NOMES_FONTES: Record<Fonte, string> = {
  finep: 'FINEP',
  cnpq: 'CNPq',
  fapeg: 'FAPEG',
  capes: 'CAPES',
}

export default function Controles({
  busca,
  fonte,
  areas,
  areasDisponiveis,
  onBusca,
  onFonte,
  onAreas,
}: {
  busca: string
  fonte: Fonte | null
  areas: string[]
  areasDisponiveis: string[]
  onBusca: (v: string) => void
  onFonte: (v: Fonte | null) => void
  onAreas: (v: string[]) => void
}) {
  function alternar(area: string) {
    onAreas(
      areas.includes(area) ? areas.filter((a) => a !== area) : [...areas, area],
    )
  }

  return (
    <div className="mt-8 flex flex-col gap-3 border-y border-[var(--line)] py-3 sm:flex-row sm:items-center sm:gap-5">
      <input
        type="search"
        value={busca}
        onChange={(e) => onBusca(e.target.value)}
        placeholder="Buscar"
        aria-label="Buscar edital por título ou descrição"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
      />

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
        role="group"
        aria-label="Minhas áreas"
      >
        <span className="text-xs text-[var(--muted)]">áreas</span>
        {areasDisponiveis.map((a) => {
          const ativa = areas.includes(a)
          return (
            <button
              key={a}
              type="button"
              aria-pressed={ativa}
              onClick={() => alternar(a)}
              className={
                ativa
                  ? 'text-[var(--ink)] underline decoration-[var(--accent)] decoration-2 underline-offset-4'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }
            >
              {ROTULOS[a] ?? a}
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-xs text-[var(--muted)]">fonte</span>
        <select
          value={fonte ?? ''}
          onChange={(e) => onFonte((e.target.value || null) as Fonte | null)}
          className="bg-transparent text-sm outline-none"
        >
          <option value="">todas</option>
          {FONTES.map((f) => (
            <option key={f} value={f}>
              {NOMES_FONTES[f]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/preferencias.ts tests/preferencias.test.ts componentes/Controles.tsx
git commit -m "feat: controles enxutos com áreas persistidas no navegador"
```

---

### Task 7: Montar o Radar e aposentar o Dashboard

**Files:**
- Create: `componentes/Radar.tsx`
- Create: `componentes/StatusFontes.tsx`
- Modify: `app/page.tsx`
- Delete: `componentes/Dashboard.tsx`

**Interfaces:**
- Consumes: tudo das tasks 2, 3, 5, 6
- Produces: `<Radar dados={Dados} />`

- [ ] **Step 1: Criar `componentes/StatusFontes.tsx`**

A mensagem real de `fontes[].erro` existe no JSON e hoje nunca é exibida — o rodapé só usa o boolean.

```tsx
import type { Dados, Fonte } from '@/scraper/schema'

const FONTES: Fonte[] = ['finep', 'cnpq', 'fapeg', 'capes']
const NOMES_FONTES: Record<Fonte, string> = {
  finep: 'FINEP',
  cnpq: 'CNPq',
  fapeg: 'FAPEG',
  capes: 'CAPES',
}

const FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
})

export default function StatusFontes({ dados }: { dados: Dados }) {
  return (
    <footer className="mt-20 border-t border-[var(--line)] pt-6 pb-16 text-xs text-[var(--muted)]">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {FONTES.map((f) => {
          const s = dados.fontes[f]
          if (!s) return null
          return (
            <li key={f} className="numeros">
              {NOMES_FONTES[f]}{' '}
              {s.ok ? (
                `coletado ${FMT.format(new Date(s.atualizadoEm))}`
              ) : (
                <span className="text-[var(--critico)]">
                  falhou ({s.erro ?? 'motivo não registrado'}) — mostrando
                  dados de {FMT.format(new Date(s.atualizadoEm))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-4">
        Coletado dos portais oficiais de cada agência —{' '}
        <a
          href="https://github.com/PedroClho/radar-editais"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--ink)]"
        >
          código no GitHub
        </a>
        .
      </p>
    </footer>
  )
}
```

- [ ] **Step 2: Criar `componentes/Radar.tsx`**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Controles from '@/componentes/Controles'
import GrupoPrazo from '@/componentes/GrupoPrazo'
import LinhaEdital from '@/componentes/LinhaEdital'
import StatusFontes from '@/componentes/StatusFontes'
import { agruparPorPrazo, filtrar } from '@/lib/editais'
import { lerAreas, salvarAreas } from '@/lib/preferencias'
import type { Dados, Fonte } from '@/scraper/schema'

export default function Radar({ dados }: { dados: Dados }) {
  // O primeiro render usa o timestamp da coleta, que é igual no servidor e no
  // cliente; depois do mount corrige para o agora real.
  const [agoraMs, setAgoraMs] = useState(() =>
    new Date(dados.atualizadoEm).getTime(),
  )
  const [busca, setBusca] = useState('')
  const [fonte, setFonte] = useState<Fonte | null>(null)
  const [areas, setAreas] = useState<string[]>([])

  useEffect(() => {
    // Só no cliente existem o "agora" real e o localStorage. Ler qualquer um
    // dos dois durante o render quebraria a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgoraMs(Date.now())
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAreas(lerAreas())
  }, [])

  function mudarAreas(novas: string[]) {
    setAreas(novas)
    salvarAreas(novas)
  }

  const vigentes = useMemo(() => {
    const g = agruparPorPrazo(dados.editais, agoraMs)
    return [...g.estaSemana, ...g.proximasSemanas, ...g.maisAdiante, ...g.semPrazo]
  }, [dados.editais, agoraMs])

  const areasDisponiveis = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const e of vigentes) {
      for (const a of e.areas) {
        if (a !== 'geral') contagem.set(a, (contagem.get(a) ?? 0) + 1)
      }
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a)
  }, [vigentes])

  const visiveis = useMemo(
    () => filtrar(vigentes, { busca, fonte, areas }),
    [vigentes, busca, fonte, areas],
  )

  const grupos = useMemo(
    () => agruparPorPrazo(visiveis, agoraMs),
    [visiveis, agoraMs],
  )

  const fechamEm7 = grupos.estaSemana.length
  const temFiltro = areas.length > 0 || fonte !== null || busca.trim() !== ''

  function limpar() {
    setBusca('')
    setFonte(null)
    mudarAreas([])
  }

  return (
    <div className="mx-auto max-w-2xl px-5 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-10 sm:pt-14">
        <h1 className="serif text-xl font-medium">Radar de Editais</h1>
        <p className="numeros text-sm text-[var(--muted)]">
          {vigentes.length} abertos
          {fechamEm7 > 0 && (
            <>
              {' · '}
              <span className="text-[var(--accent-forte)]">
                {fechamEm7} {fechamEm7 === 1 ? 'fecha' : 'fecham'} em 7 dias
              </span>
            </>
          )}
        </p>
      </header>

      <Controles
        busca={busca}
        fonte={fonte}
        areas={areas}
        areasDisponiveis={areasDisponiveis}
        onBusca={setBusca}
        onFonte={setFonte}
        onAreas={mudarAreas}
      />

      {temFiltro && visiveis.length > 0 && (
        <p className="numeros mt-3 text-xs text-[var(--muted)]">
          mostrando {visiveis.length} de {vigentes.length} ·{' '}
          <button type="button" onClick={limpar} className="underline">
            ver todos
          </button>
        </p>
      )}

      <main>
        <GrupoPrazo
          titulo="Esta semana"
          editais={grupos.estaSemana}
          agoraMs={agoraMs}
        />
        <GrupoPrazo
          titulo="Próximas semanas"
          editais={grupos.proximasSemanas}
          agoraMs={agoraMs}
        />
        <GrupoPrazo
          titulo="Mais adiante"
          editais={grupos.maisAdiante}
          agoraMs={agoraMs}
        />

        {grupos.semPrazo.length > 0 && (
          <section className="mt-12">
            <h2 className="flex items-baseline gap-3 text-xs tracking-wider text-[var(--muted)] uppercase">
              Sem prazo divulgado
              <span className="numeros text-[var(--line)]">
                {grupos.semPrazo.length}
              </span>
            </h2>
            <ul className="mt-3 border-t border-[var(--line)]">
              {grupos.semPrazo.map((e) => (
                <LinhaEdital key={e.id} edital={e} agoraMs={agoraMs} />
              ))}
            </ul>
          </section>
        )}

        {visiveis.length === 0 && (
          <div className="mt-20 text-center text-[var(--muted)]">
            <p>Nenhum edital com esses filtros.</p>
            <button type="button" onClick={limpar} className="mt-2 underline">
              Limpar filtros
            </button>
          </div>
        )}
      </main>

      <StatusFontes dados={dados} />
    </div>
  )
}
```

- [ ] **Step 3: Apontar a página para o Radar e remover o Dashboard**

`app/page.tsx`:

```tsx
import Radar from '@/componentes/Radar'
import dadosJson from '@/data/editais.json'
import type { Dados } from '@/scraper/schema'

const dados = dadosJson as unknown as Dados

export default function Home() {
  return <Radar dados={dados} />
}
```

```bash
git rm componentes/Dashboard.tsx
```

- [ ] **Step 4: Verificar**

Run: `npx vitest run && npx tsc --noEmit && npx next lint && npx next build`
Expected: testes verdes, sem erro de tipo, sem erro de lint, build verde com `/` marcada `○ (Static)`.

- [ ] **Step 5: Conferir no navegador**

Run: `npm run dev` e abrir `http://localhost:3000`.

Conferir, nesta ordem:
1. A primeira coisa abaixo do cabeçalho é um edital, não um parágrafo explicativo.
2. As datas formam uma coluna alinhada à esquerda; os dígitos alinham entre linhas.
3. Um edital que fecha em ≤3 dias aparece em `--critico`; entre 4 e 14, em `--accent-forte`; acima disso, neutro.
4. A descrição aparece em no máximo 2 linhas e não está em CAIXA ALTA.
5. Clicar numa área filtra; recarregar a página mantém a área marcada.
6. Com filtro ativo aparece "mostrando N de M · ver todos".
7. Nenhum aviso de hidratação no console.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx componentes/Radar.tsx componentes/StatusFontes.tsx
git commit -m "feat: agenda de prazos substitui o dashboard antigo"
```

---

### Task 8: Prazo da FAPEG a partir do PDF

Os 5 editais da FAPEG não têm prazo nenhum hoje. A data está no PDF, numa tabela "CRONOGRAMA", e os 5 PDFs testados tinham texto extraível.

**Files:**
- Modify: `scraper/fontes/fapeg.ts`
- Modify: `package.json` (dependência `pdf-parse`)
- Create: `tests/fixtures/fapeg-cronograma.txt`
- Test: `tests/fontes.test.ts`

**Interfaces:**
- Produces: `extrairPrazoCronograma(textoPdf: string): string | undefined` — devolve ISO ou `undefined`

- [ ] **Step 1: Capturar a fixture**

Baixar um PDF real de edital da FAPEG e salvar só o texto extraído, para o teste rodar offline:

```bash
npm i pdf-parse
node -e "
const fs=require('fs');
const pdf=require('pdf-parse');
(async()=>{
  const url=process.argv[1];
  const buf=Buffer.from(await (await fetch(url)).arrayBuffer());
  const {text}=await pdf(buf);
  fs.writeFileSync('tests/fixtures/fapeg-cronograma.txt', text);
  console.log('salvo,', text.length, 'chars');
})()
" "<URL do PDF de um edital aberto da FAPEG>"
```

A URL sai de `data/editais.json` (campo `url` dos editais com `fonte: 'fapeg'`) → abrir a página → link do PDF do edital.

Conferir que o arquivo salvo contém a palavra `CRONOGRAMA` seguida de datas:

```bash
grep -A12 -i cronograma tests/fixtures/fapeg-cronograma.txt | head -20
```

- [ ] **Step 2: Escrever o teste que falha**

Acrescentar em `tests/fontes.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { extrairPrazoCronograma } from '../scraper/fontes/fapeg'

const cronograma = readFileSync(
  new URL('./fixtures/fapeg-cronograma.txt', import.meta.url),
  'utf8',
)

describe('extrairPrazoCronograma', () => {
  test('acha a data limite de submissão no cronograma do PDF', () => {
    // Ajustar a data esperada para a que estiver na fixture capturada.
    expect(extrairPrazoCronograma(cronograma)).toBe('2026-09-04T23:59:59.000Z')
  })

  test('devolve undefined quando não há cronograma', () => {
    expect(extrairPrazoCronograma('texto qualquer sem datas')).toBeUndefined()
  })

  test('ignora o sumário e pega a tabela real', () => {
    const comSumario = [
      '1. OBJETO .... 3',
      '7. CRONOGRAMA .... 12',
      'blá blá',
      'CRONOGRAMA',
      'Limite para Submissão das propostas até às 17:00 horas do dia 10/07/2026',
    ].join('\n')
    expect(extrairPrazoCronograma(comSumario)).toBe('2026-07-10T23:59:59.000Z')
  })

  test('aceita a variação de rótulo "Limite para Inscrições"', () => {
    const texto = [
      'CRONOGRAMA',
      'Limite para Inscrições na plataforma SPARKX FAPEG De 25/06/2026 até 04/08/2026 às 17h',
    ].join('\n')
    expect(extrairPrazoCronograma(texto)).toBe('2026-08-04T23:59:59.000Z')
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run tests/fontes.test.ts`
Expected: FAIL — `extrairPrazoCronograma` não exportado.

- [ ] **Step 4: Implementar**

Acrescentar em `scraper/fontes/fapeg.ts`:

```ts
import { dataBrParaIso } from '../util'

// A data de submissão da FAPEG só existe dentro do PDF, na tabela
// "CRONOGRAMA". Os rótulos variam entre editais, e a palavra CRONOGRAMA
// costuma aparecer antes no sumário — por isso procuramos a ÚLTIMA
// ocorrência seguida de datas, e dentro dela a maior data do rótulo de
// limite (editais com faixa "de X até Y" precisam do Y).
const RE_LIMITE =
  /limite\s+para\s+(?:submiss[ãa]o|inscri[çc][õo]es)[^\n]*/gi

export function extrairPrazoCronograma(texto: string): string | undefined {
  const idx = texto.toUpperCase().lastIndexOf('CRONOGRAMA')
  const trecho = idx >= 0 ? texto.slice(idx) : texto
  const linhas = trecho.match(RE_LIMITE)
  if (!linhas) return undefined
  const datas = linhas
    .flatMap((linha) => linha.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [])
    .map((d) => dataBrParaIso(d, { fimDoDia: true }))
    .filter((d): d is string => Boolean(d))
  if (datas.length === 0) return undefined
  return datas.sort().at(-1)
}
```

Depois, no `coletarFapeg`, para cada edital sem prazo: buscar a página individual, extrair o `href` do PDF do edital com cheerio, baixar, passar por `pdf-parse` e aplicar `extrairPrazoCronograma`. Envolver **cada** edital em `try/catch` — um PDF ilegível não pode derrubar a fonte inteira:

```ts
for (const edital of editais) {
  if (edital.inscricaoFim) continue
  try {
    edital.inscricaoFim = await prazoDoPdf(edital.url)
  } catch {
    // Sem prazo é um estado válido — segue com "prazo no edital".
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run`
Expected: PASS em todos os arquivos.

- [ ] **Step 6: Rodar o scraper de verdade**

Run: `npm run scrape`
Expected: `data/editais.json` regravado. Conferir:

```bash
node -e "
const d=require('./data/editais.json');
const f={};
for(const e of d.editais){f[e.fonte]??={t:0,p:0};f[e.fonte].t++;if(e.inscricaoFim)f[e.fonte].p++}
console.log(f);
console.log('total com prazo:', d.editais.filter(e=>e.inscricaoFim).length,'/',d.editais.length);
"
```
Expected: `fapeg` com prazo em ~5 de 5; `finep` em ~22 de 36; total bem acima dos 15 de antes.

- [ ] **Step 7: Commit**

```bash
git add scraper/fontes/fapeg.ts tests/fontes.test.ts tests/fixtures/fapeg-cronograma.txt package.json package-lock.json data/editais.json
git commit -m "feat: FAPEG extrai prazo do cronograma do PDF do edital"
```

---

### Task 9: Verificação final

**Files:** nenhum arquivo novo; só correções pontuais se algo falhar.

- [ ] **Step 1: Suíte completa**

Run: `npx vitest run && npx tsc --noEmit && npx next lint && npx next build`
Expected: tudo verde; `/` continua `○ (Static)`.

- [ ] **Step 2: Conferir que os editais vencidos sumiram**

```bash
node -e "
const d=require('./data/editais.json');
const hoje=Date.now();
const venc=d.editais.filter(e=>e.inscricaoFim && new Date(e.inscricaoFim)<hoje);
console.log('vencidos ainda no JSON:', venc.length, '(ok — o front filtra)');
venc.forEach(e=>console.log(' -', e.inscricaoFim.slice(0,10), e.titulo.slice(0,50)));
"
```
Expected: qualquer que seja o número, nenhum deles aparece na página. Conferir no navegador que "FIP Startup Inteligência Artificial" (venceu 28/05) não está listado.

- [ ] **Step 3: Celular**

Abrir `npm run dev` com o viewport em 390px de largura.
Expected: a coluna de datas encolhe para `3.5rem` mas continua alinhada; nada estoura horizontalmente; os controles empilham.

- [ ] **Step 4: Dark mode e contraste**

Alternar o tema do sistema para escuro.
Expected: `--critico` (`#f98a6a`) e `--muted` (`#9a9ea6`) legíveis sobre `--bg` (`#121316`). Conferir no DevTools que o texto de corpo passa em WCAG AA (4.5:1).

- [ ] **Step 5: Teclado**

Navegar a página só com Tab.
Expected: cada linha de edital é um alvo focável com contorno visível (`:focus-visible` já está no CSS); busca, botões de área e select alcançáveis.

- [ ] **Step 6: Commit final se houve ajuste**

```bash
git add -A
git commit -m "fix: ajustes da verificação final do redesign"
```

---

## Self-Review

**Cobertura da spec:**

| Requisito da spec | Task |
|---|---|
| Bug do `prazoProposto` na FINEP | 1 |
| `limparTitulo` / `normalizarCaixa` / `resumir` | 2 |
| Agrupamento em 4 grupos, ordenação | 3 |
| Escala de urgência em 3 faixas | 3 (lógica) + 5 (cor) |
| Vencido sai do radar | 3 |
| Newsreader + Archivo, remove Plex Mono | 4 |
| `--critico`, remove `--accent-suave` | 4 |
| Espinha de data, um foco por linha | 5 |
| Descrição visível em 2 linhas | 5 |
| Áreas sem cor, viram texto | 5 |
| Controles enxutos no lugar dos 13 chips | 6 |
| Personalização em localStorage | 6 |
| Mensagem real de erro da fonte no rodapé | 7 |
| Estado vazio com "limpar filtros" | 7 |
| Header sem hero | 7 |
| FAPEG via PDF | 8 |
| Verificação (mobile, dark, a11y, SSG) | 9 |
| CAPES sem mudança | — (decisão registrada na spec) |

**Consistência de tipos:** `Grupos`, `Urgencia`, `Fonte` e `Edital` são usados com os mesmos nomes nas tasks 3, 5, 6 e 7. `agruparPorPrazo` é chamada duas vezes na Task 7 (uma para `vigentes`, outra para `visiveis`) — é a mesma função pura, sem estado, então é seguro.

**Ponto de atenção deixado explícito:** a Task 8 depende de capturar uma fixture real, e a data esperada no teste precisa ser ajustada para a do PDF capturado. Isso está sinalizado no próprio step em vez de virar um valor inventado.
