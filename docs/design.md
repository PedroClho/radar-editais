# Radar de Editais — dashboard de editais de fomento (IA-first)

## Contexto

Feedback do professor na apresentação de IoT: faltaram links para editais de financiamento (ex: FINEP). Ele citou um professor da UFG que anota **no quadro, à mão**, os editais próximos — e disse que seria ótimo se um aluno criasse um sistema que buscasse isso na internet e mantivesse atualizado. Pedro quer construir exatamente isso: um **dashboard minimalista** que agrega editais de fomento brasileiros, **atualizado automaticamente**, com foco inicial em **IA** (curso de IA da UFG) e rótulos por área (saúde, agro, tecnologia...). Útil para a turma, para o professor e potencialmente para qualquer brasileiro.

## Decisões já tomadas com o usuário

| Decisão | Escolha |
|---|---|
| Stack | **TypeScript full-stack — Next.js** (App Router) |
| Extração/classificação | **Regras + palavras-chave** (100% grátis, sem LLM) |
| Fontes do MVP | **FINEP, CNPq, FAPEG, CAPES** |
| Atualização/hospedagem | **GitHub Actions (cron diário) → `data/editais.json` commitado → Vercel redeploya site estático**. Sem banco, custo zero |

**Projeto novo e separado**: criar em `~/Projetos/radar-editais` (repo próprio no GitHub `PedroClho`, deploy no Vercel do Pedro). Nada é alterado no repo `IOT-BIA-2026`.

## Recon das fontes (verificado por agentes em 17/07/2026, URLs testadas com GET real)

| Fonte | Como coletar | Abertos hoje | Prazo disponível? |
|---|---|---|---|
| **FINEP** | **API JSON pública, sem auth**: `GET https://www.finep.gov.br/o/c/chamadapublicas?filter=situacao eq 'aberta'&pageSize=100` (Liferay/OData). Campos: `titulo`, `descricao`, `situacao`, `vigenciaInicio/Fim` (ISO), `temaPrincipal`, `tema`, `publicoAlvo` | 36 | Sim (`vigenciaFim`) |
| **CNPq** | Scrape HTML server-rendered (Plone): `https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas`, paginação `?b_start:int=N` (passo 5), itens em `article .tileHeadline a`. Datas de inscrição (dd/mm/yyyy) após rótulo "Inscrições:" na página de cada chamada | ~10–15 | Sim (texto) |
| **FAPEG** | **Tabela curada** `https://goias.gov.br/fapeg/editais/inscricoes-abertas/` (colunas Nº/Tipo/Origem/Descrição/Link) = fonte de verdade dos abertos; enriquecer com **REST WordPress** `https://goias.gov.br/fapeg/wp-json/wp/v2/posts?categories=2&per_page=100` (JSON limpo, datas ISO) | ~5 | Parcial (datas no texto/excerpt) |
| **CAPES** | Scrape de `https://www.gov.br/capes/pt-br/assuntos/editais-e-resultados-capes` (Plone Document): âncoras com `/centrais-de-conteudo/editais/` + `@@display-file` dentro de `#content-core`. **Sem datas no HTML** (só dentro dos PDFs) — MVP exibe sem prazo ("ver edital") | ~2 | Não |

Pegadinhas confirmadas no recon (tratar no código):
- **`memoria2.cnpq.br` está instável (connection reset)** — usar só o portal gov.br.
- gov.br às vezes serve página de "manutenção" com HTTP 200 → **validar conteúdo** (checar seletor esperado) **+ retry**.
- Cadeia SSL gov.br falha em alguns clients — usar `fetch`/`undici` do Node com CA do sistema (curl funciona; testar no CI).
- FAPEG: usar sempre `goias.gov.br/fapeg` (domínio sem `www` antigo dá timeout); encoding misto (respeitar `Content-Type` por página).
- FINEP: filtro OData é `situacao eq 'aberta'` (a forma `situacao/key eq` retorna 400); há registros de teste no dataset → filtrar também `status.label === 'approved'`.
- Sempre enviar User-Agent de navegador.

## Arquitetura

```
GitHub Actions (cron 1x/dia 07:00 BRT + disparo manual)
  └─ npm run scrape  (tsx scraper/index.ts)
       ├─ scraper/fontes/finep.ts   (API JSON)
       ├─ scraper/fontes/cnpq.ts    (fetch + cheerio)
       ├─ scraper/fontes/fapeg.ts   (tabela + wp-json)
       ├─ scraper/fontes/capes.ts   (fetch + cheerio)
       ├─ scraper/classificador.ts  (palavras-chave → areas[] + flag IA)
       └─ escreve data/editais.json (merge com fallback por fonte)
  └─ commit do JSON (se mudou) → push
        └─ Vercel detecta push → rebuild do site Next.js (SSG)

Next.js lê data/editais.json em build time → dashboard estático,
filtros 100% client-side (dataset pequeno, ~50 itens)
```

## Modelo de dados (`scraper/schema.ts`, validado com Zod)

```ts
type Edital = {
  id: string                 // hash estável de fonte+url
  fonte: 'finep' | 'cnpq' | 'fapeg' | 'capes'
  titulo: string
  url: string                // página/PDF do edital
  descricao?: string
  inscricaoInicio?: string   // ISO
  inscricaoFim?: string      // ISO; ausente = "ver edital"
  situacao: 'aberto' | 'encerrado' | 'indefinido'
  areas: string[]            // ['saude','agro','tecnologia','educacao',...]
  ia: boolean                // destaque IA
  coletadoEm: string         // ISO
}
// data/editais.json = { atualizadoEm, fontes: { finep: {ok, quantidade, erro?}, ... }, editais: Edital[] }
```

## Classificador por palavras-chave (`scraper/classificador.ts`)

- Normaliza (minúsculas, sem acento) título+descrição e casa contra um dicionário editável `AREAS: Record<string, string[]>` — ex.: `ia: ['inteligencia artificial','machine learning','aprendizado de maquina','ciencia de dados','visao computacional','processamento de linguagem natural', ...]`, `saude`, `agro`, `tecnologia`, `educacao`, `energia`, `industria`.
- FINEP já entrega `temaPrincipal`/`tema`/`publicoAlvo` estruturados → mapear direto para áreas além das palavras-chave.
- Edital sem match → `areas: ['geral']`. Flag `ia` separada das áreas (IA é transversal: um edital de saúde pode ter IA).

## Robustez (regra central do merge em `scraper/index.ts`)

Cada fonte roda isolada em try/catch. Se uma fonte falhar (site fora, layout mudou, 0 itens onde se esperava >0), **reutiliza os editais da execução anterior** (lê o `data/editais.json` existente) e marca `fontes.<nome> = {ok: false, erro}`. O dashboard mostra no rodapé o status por fonte ("FINEP atualizado hoje · CAPES com erro há 2 dias"). Assim uma fonte quebrada nunca apaga dados nem derruba o site.

## Frontend (minimalista, PT-BR, mobile-first)

- `app/page.tsx` (server) importa o JSON; `componentes/Dashboard.tsx` (client) faz filtro/busca em memória.
- **Agrupamento por urgência**: "Encerram em breve" (≤14 dias), "Abertos", "Sem prazo definido"; encerrados ficam fora do MVP.
- Cada edital: título (link externo), badge da fonte, chips de área, **badge IA em destaque**, prazo com contagem ("encerra em 12 dias").
- Filtros: chips por área, por fonte, toggle "só IA" e busca por texto. Sem login, sem gráficos.
- Tailwind CSS, fonte do sistema/Inter, dark mode via `prefers-color-scheme`. Sem lib de UI pesada.

## Estrutura do repo `~/Projetos/radar-editais`

```
app/ (Next.js App Router)   componentes/   data/editais.json
scraper/{index,schema,classificador,http}.ts  scraper/fontes/{finep,cnpq,fapeg,capes}.ts
tests/ (Vitest + fixtures HTML/JSON reais)    .github/workflows/atualiza-editais.yml
CLAUDE.md (com a seção # superpowers, conforme regra global)   README.md (PT-BR)
```

Dependências: `next`, `react`, `tailwindcss`, `cheerio`, `zod`, `tsx`, `vitest`.

## Etapas de implementação

1. **Scaffold**: `create-next-app` (TS + Tailwind + App Router) em `~/Projetos/radar-editais`; git init; CLAUDE.md do projeto (incluindo seção `# superpowers`); Vitest configurado.
2. **Schema + classificador** (TDD): tipos Zod, normalização de texto, dicionário de áreas, testes com títulos reais colhidos no recon (ex.: "Chamada CNPq nº 25/2026 Endometriose" → saude).
3. **Scrapers** (TDD com fixtures): salvar respostas reais como fixtures em `tests/fixtures/`; um módulo por fonte com a mesma interface `coletar(): Promise<Edital[]>`; helper `scraper/http.ts` (retry ×3, User-Agent de navegador, validação de conteúdo anti-página-de-manutenção).
4. **Merge + persistência**: junta fontes, dedupe por `id`, aplica fallback por fonte falha, ordena por `inscricaoFim`, escreve `data/editais.json`.
5. **Dashboard**: página única com agrupamento por urgência, filtros e status das fontes no rodapé.
6. **Automação/deploy**: workflow com `schedule: cron '0 10 * * *'` + `workflow_dispatch`, `permissions: contents: write`, commit do JSON como `Pedro Coelho <coelho@discente.ufg.br>` (msg `chore: atualiza editais`), push. Criar repo no GitHub `PedroClho` e publicar. **Passo manual do Pedro**: importar o repo no Vercel (conta dele) — deixar instruções no README.
7. **README** em PT-BR: o que é, como rodar, como adicionar uma fonte nova, como ajustar o dicionário de áreas.

Commits em PT-BR como `Pedro Coelho <coelho@discente.ufg.br>`, sem Co-Authored-By (regra global).

## Verificação (fim a fim)

1. `npm test` — parsers contra fixtures + classificador + fallback do merge.
2. `npm run scrape` real → conferir `data/editais.json`: as 4 fontes com `ok: true` e quantidades plausíveis (FINEP ~36, CNPq ~10, FAPEG ~5, CAPES ~2).
3. Simular falha (URL inválida numa fonte) → confirmar que o JSON preserva os dados antigos da fonte e marca `ok: false`.
4. `npm run dev` → conferir dashboard: grupos por urgência, filtros de área/fonte, toggle IA, contagem de prazo, rodapé de status.
5. Push + `workflow_dispatch` manual no GitHub → confirmar commit automático do JSON e build verde; após Pedro conectar o Vercel, conferir o site publicado.

## Fora do escopo do MVP (v2, se quiser depois)

Extração de prazos dos PDFs da CAPES; mais fontes (FAPESP e outras FAPs, EMBRAPII, SEBRAE, BNDES); alertas (e-mail/Telegram) e feed RSS próprio; histórico/arquivo de encerrados (o git já guarda o histórico do JSON de graça).
