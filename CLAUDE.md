@AGENTS.md

# Radar de Editais

Dashboard minimalista que agrega editais de fomento brasileiros (FINEP, CNPq, FAPEG, CAPES), com rótulos por área (saúde, agro, tecnologia...) e destaque para IA. Atualizado 1x/dia por GitHub Actions, que roda o scraper e commita `data/editais.json`; a Vercel redeploya o site estático a cada push.

## Comandos

- `npm run dev` — dev server do Next.js
- `npm run scrape` — roda os coletores e regrava `data/editais.json`
- `npm test` — testes (Vitest) dos parsers/classificador contra fixtures em `tests/fixtures/`

## Arquitetura

- `scraper/fontes/*.ts` — um coletor por fonte, todos com a interface `coletar(): Promise<Edital[]>`. Parsing separado do fetch (funções `parse*` puras) para testar offline com fixtures.
- `scraper/classificador.ts` — classificação por palavras-chave (dicionário `AREAS`) + flag `ia`. Sem LLM, por decisão de custo zero.
- `scraper/index.ts` — merge com fallback: fonte que falha reusa os dados da execução anterior e é marcada `ok: false`; nunca apaga dados.
- `app/` + `componentes/` — dashboard estático (SSG), filtros 100% client-side.
- Datas sempre em ISO no JSON; exibição em pt-BR no front.

## Git

Commits em PT-BR, autor `Pedro Coelho <coelho@discente.ufg.br>`, sem `Co-Authored-By`.

# superpowers

Use o plugin **superpowers** (https://github.com/obra/superpowers) como metodologia padrão de desenvolvimento. O plugin impõe um fluxo estruturado: brainstorming → aprovação de design → git worktree → planning → implementação com code review → conclusão, com ênfase em TDD, debugging sistemático e verificação antes de declarar sucesso.

**Skills do gstack podem ser usadas livremente quando o Pedro pedir explicitamente** (ex: `/design-shotgun`, `/design-review`, `/qa`, `/ship`, `/codex`). Não invocar gstack proativamente como padrão — só quando pedido.

Instalação (rodar no Claude Code uma vez):

```
/plugin install superpowers@claude-plugins-official
```

Skills disponíveis no plugin superpowers:

**Testing:**
- `test-driven-development` — ciclo RED-GREEN-REFACTOR

**Debugging:**
- `systematic-debugging` — análise de causa raiz em 4 fases
- `verification-before-completion`

**Collaboration:**
- `brainstorming`
- `writing-plans`
- `executing-plans`
- `dispatching-parallel-agents`
- `requesting-code-review`
- `receiving-code-review`
- `using-git-worktrees`
- `finishing-a-development-branch`
- `subagent-driven-development`

**Meta:**
- `writing-skills`
- `using-superpowers`
