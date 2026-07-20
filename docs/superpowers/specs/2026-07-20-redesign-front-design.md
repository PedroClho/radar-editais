# Redesign do front — Radar de Editais

Data: 2026-07-20

## Problema

O front atual (`componentes/Dashboard.tsx`, 378 linhas, um único componente) é
descrito pelo Pedro como "muito básico, difícil de ver o que realmente
queremos, muita informação e muita cara de IA".

Diagnóstico concreto, a partir do screenshot em `docs/screenshot.png` e da
leitura do código:

1. **Dois focos por linha.** O título e o contador de dias (2xl, semibold,
   alinhado à direita) competem pela atenção. O olho não sabe onde pousar.
2. **A barra de progresso não informa nada.** `JanelaInscricao` desenha uma
   barra de 3px com a fração decorrida do período de inscrição. É decoração:
   a mesma cor âmbar em todos os itens, sem rótulo, sem escala.
3. **Nada indica relevância.** Os itens de "Inscrições abertas" são
   visualmente idênticos entre si.
4. **O título é engolido pela burocracia.** "Chamada Pública CNPq N° 07/2026 -
   Programa Institucional de Bolsas de Pós-Graduação (PIBPG)" gasta metade da
   linha antes de dizer o assunto. Mediana de 61 caracteres, máximo de 137.
5. **A descrição nunca é exibida.** Existe em 41 dos 53 editais e é usada
   apenas como texto de busca — o usuário não consegue saber do que se trata
   sem sair do site.
6. **Assinaturas de "gerado por IA"**: microlabels em monospace maiúsculo,
   parede de 13 chips-pílula, hero com parágrafo explicativo genérico.

## Decisões tomadas com o Pedro

| Pergunta | Resposta |
|---|---|
| Job principal da página | **"O que fecha logo?"** — painel de prazos, radar temporal |
| Público | **Ferramenta de quem volta** (Pedro, turma de IA, professor). Não precisa se explicar; densidade máxima acima da dobra |
| Destaque de IA | **Site lembra a área do usuário** (localStorage). Nenhuma área privilegiada no código; quem marca IA tem um Radar IA-first |
| Escopo | **Front + garimpar prazos** — inclui correções no scraper |
| Estrutura | **Agenda: a data é a espinha vertical à esquerda** |

## Achados de dados (medidos, não estimados)

Cobertura de `inscricaoFim` em `data/editais.json` (53 editais):

| fonte | total | tem prazo | tem descrição |
|---|---|---|---|
| cnpq | 10 | 9 | 0 |
| finep | 36 | 6 | 36 |
| fapeg | 5 | 0 | 5 |
| capes | 2 | 0 | 0 |

**15 de 53 (28%)** têm prazo. Um radar de prazos sobre 28% dos dados não se
sustenta — daí o escopo incluir o scraper.

### Bug de correção na FINEP (não só de cobertura)

Verificado com `GET` real na API da FINEP em 20/07/2026:

- `scraper/fontes/finep.ts:58` lê `vigenciaFim`, presente em **6** de 36.
- O campo correto é **`prazoProposto`**, presente em **22** de 36 — é o valor
  que a própria página do edital exibe sob o rótulo "Prazo para envio de
  propostas até:".
- Nos 6 registros que têm ambos, as datas **divergem, sempre no sentido
  perigoso**: `vigenciaFim` é mais tardio. O edital BRICs mostra hoje
  "até 19/11" quando o prazo real de envio é **14/08**. Três meses de folga
  fantasma — alguém confiando no site perde a submissão.

### Editais vencidos exibidos como abertos

6 registros da FINEP têm `situacao: 'aberta'` e `status: 'approved'` na origem
mas prazo **no passado** — entre eles "FIP Startup Inteligência Artificial"
(venceu 28/05/2026), que é um dos 3 editais de IA do dataset.

**Regra:** a `situacao` vinda da fonte não é confiável. O prazo calculado
manda. Prazo no passado ⇒ encerrado, fora do radar.

### Cobertura projetada após as correções

| fonte | com prazo, vigentes | sem prazo |
|---|---|---|
| finep | 16 (22 menos 6 vencidos) | 14 |
| cnpq | 9 | 1 |
| fapeg | 5 (via PDF) | 0 |
| capes | 0 (inviável) | 2 |
| **total** | **30** | **17** |

De 15/53 para **30 de 47 editais vigentes (64%)** com prazo real.

### CAPES fica sem prazo (decisão explícita)

Os 2 links da CAPES apontam direto para PDF. Um tem texto extraível; o outro
(24 páginas, ~10MB) é **escaneado** — exigiria OCR. Para 2 editais, o custo e
o risco não se pagam. CAPES continua como "prazo no edital". Documentado aqui
para não ser reinvestigado.

## Referências de design consultadas

Pesquisa em 27 ferramentas. O que sustenta as decisões abaixo:

- **Nenhum agregador brasileiro de fomento resolve comunicação de prazo.** O
  CNPq chega a colar a data no fim de um link de PDF, sem rótulo. Isso é a
  lacuna real que o Radar preenche: normalizar prazo como campo estruturado.
- **Linear** (`linear.app/docs/due-dates`): 3 faixas de urgência — vermelho
  (hoje/atrasado), laranja (≤1 semana), cinza no resto. Cor restrita ao sinal
  semântico.
- **Vercel Geist Table** (`vercel.com/geist/table`): `tabular-nums` em colunas
  numéricas; valor ausente é em-dash, nunca célula vazia; data relativa perto
  do presente, absoluta longe.
- **Sentry**: um único quadrado colorido por linha indica severidade; o resto
  é neutro.
- **Asana** (contra-exemplo documentado): urgência binária só avisa quando já
  é tarde. Reclamação registrada no fórum oficial.
- **NN/g**: cor sozinha é 57% mais lenta de escanear e falha para daltônicos;
  cor + texto/ícone é 37% mais rápida.

### Anti-padrões evitados deliberadamente

Do estudo de Adrian Krebs (1.590 landing pages do Show HN classificadas por
padrão visual) e fontes correlatas:

| Anti-padrão | Como este design evita |
|---|---|
| Gradiente indigo/roxo | Zero gradientes |
| Inter como default sem intenção | Newsreader + Archivo, escolha justificada |
| Borda lateral colorida em card | Sem cards; linhas separadas por hairline |
| Grid de 3 cards ícone+título+parágrafo | Não existe; status das fontes é lista |
| Badge "eyebrow" pill acima do H1 | Removido (o atual tem um) |
| Labels em CAIXA ALTA + cinza claro | Monospace maiúsculo eliminado |
| Ícones genéricos ao lado de cada label | Ícone só onde carrega informação |
| Border-radius 24px+ uniforme | Raio contido, 4px |
| Copy genérico de marketing | Números concretos: "5 fecham em 7 dias" |
| Hero centralizado + subtítulo | Removido; primeira linha visível é edital |

## Design

### Estrutura da página

```
Radar de Editais              30 abertos · 5 fecham em 7 dias · atualizado hoje
─────────────────────────────────────────────────────────────────────────────
[ buscar ]            minhas áreas: IA, saúde ✎        fonte: todas ▾
─────────────────────────────────────────────────────────────────────────────

ESTA SEMANA

  qua      Avaliações de Políticas, Programas e Ações em Saúde
  29/07    Seleção de propostas para avaliação de políticas públicas…
           CNPq · saúde · nº 18/2026              faltam 9 dias

PRÓXIMAS SEMANAS

  seg      Programa Tecnova 2026/2027
  03/08    Seleção de agentes operacionais para repasse de subvenção…
           FINEP · tecnologia                    faltam 14 dias

MAIS ADIANTE
  …

SEM PRAZO DIVULGADO · 17
  Agricultura familiar para ICTs 2026     FINEP · agro    prazo no edital
  …
```

**Um foco por linha.** A data sai da direita e vira o eixo vertical. O olho
desce uma coluna de datas; os títulos penduram nela. O contador "faltam N
dias" fica em texto pequeno, como confirmação — não como segundo foco.

### Agrupamento temporal

| Grupo | Critério |
|---|---|
| Esta semana | ≤ 7 dias |
| Próximas semanas | 8–30 dias |
| Mais adiante | > 30 dias |
| Sem prazo divulgado | sem `inscricaoFim` |

Ordenação: dentro dos três primeiros grupos, por prazo crescente (o que fecha
antes vem primeiro). Em "Sem prazo divulgado", por `coletadoEm` decrescente —
sem data para ordenar, o mais recentemente visto é o palpite mais útil.

Encerrados (prazo no passado) não aparecem.

### Escala de urgência

Três faixas, cor **apenas** na espinha de data, sempre acompanhada de texto:

| Faixa | Tratamento |
|---|---|
| ≤ 3 dias | Vermelho-tijolo, peso maior. "faltam 2 dias" / "último dia" |
| 4–14 dias | Ocre (`--accent`, já existe) |
| > 14 dias | Neutro — sem cor |

Sem verde: verde sinaliza "seguro" e atrai o olho para o item errado (erro
documentado do Todoist).

### Tipografia

- **Newsreader** (serifada) — títulos dos editais. Edital é documento; a
  serifada dá voz editorial e é o oposto do default de LLM.
- **Archivo** (sans) — todo o chrome: controles, metadados, cabeçalhos de
  grupo, números. Já está no projeto.
- **IBM Plex Mono é removido.** O microlabel monospace maiúsculo espalhado
  era a principal assinatura visual de "gerado por IA". Alinhamento numérico
  passa a vir de `font-variant-numeric: tabular-nums` na própria Archivo.

### Cor

Base atual mantida (`--bg`, `--ink`, `--muted`, `--line`, `--accent`), mais um
token novo `--critico` para a faixa de ≤3 dias. `--accent-suave` é removido:
hoje é um token órfão, definido em `globals.css` e referenciado em lugar
nenhum. Dark mode continua por `prefers-color-scheme`.

Áreas **não** ganham cor. Viram texto discreto ao lado da fonte. Isso elimina
a parede de 13 chips-pílula do topo.

### Limpeza de conteúdo (funções puras, testáveis)

Duas correções que valem mais que qualquer ajuste de pixel:

1. **`limparTitulo(titulo)`** — extrai o prefixo burocrático para uma linha
   secundária. `"Chamada Pública CNPq N° 07/2026 - Programa Institucional de
   Bolsas de Pós-Graduação (PIBPG)"` → título `"Programa Institucional de
   Bolsas de Pós-Graduação (PIBPG)"` + referência `"nº 07/2026"`. Quando o
   padrão não casa, devolve o título intacto — nunca perde informação.

2. **`normalizarCaixa(texto)`** — `"CARTA CONVITE MCTI/FINEP - PROGRAMA
   TECNOVA 2026/2027"` para de gritar. Preserva siglas via allowlist
   (MCTI, FINEP, CNPq, CAPES, FAPEG, PIBPG, FNDCT, SUS, BRICS…) e tokens
   curtos. Aplicada a título e descrição — as descrições da FINEP são todas
   em caixa alta.

3. **`resumir(descricao)`** — a descrição vem truncada em 400 caracteres pelo
   scraper (mediana = máximo = 400, sinal de `.slice(0, 400)`). Exibida em no
   máximo 2 linhas com `line-clamp`, cortando em limite de palavra.

### Personalização

`localStorage['radar:areas']` guarda as áreas escolhidas. Regras:

- Primeira visita: **sem filtro**, mostra tudo.
- Com preferência salva: abre filtrado, e **sempre** exibe que há filtro
  ativo — "mostrando 12 de 30 · ver todos". Nunca esconder dados em silêncio.
- Aplicado **após a montagem** (`useEffect`), não na renderização — ler
  `localStorage` durante o render estático quebra a hidratação. A transição é
  de "tudo" para "filtrado", ou seja, um estreitamento; não há flash de
  conteúdo errado.

### Controles

Uma barra fina, três controles, substituindo os 13 chips atuais:

- busca por texto (mantém o comportamento atual: título + descrição)
- "minhas áreas" — é ao mesmo tempo o filtro e o controle de personalização
- fonte — dropdown

Sem command palette: a pesquisa mostra que Cmd+K serve power users; chips e
busca visíveis servem o público real deste site.

### Estados de erro e vazio

| Situação | Tratamento |
|---|---|
| Fonte falhou na coleta | Rodapé mostra a mensagem real de `fontes[].erro` — hoje a string existe no JSON e **nunca é exibida** |
| Filtro sem resultado | Estado vazio com ação "limpar filtros" |
| Edital sem prazo | "prazo no edital" — nunca campo em branco |
| Prazo no passado | Fora do radar (a `situacao` da fonte não é confiável) |

## Arquitetura

Hoje: um componente cliente de 378 linhas com tudo dentro. Passa a:

```
app/page.tsx                  server — lê o JSON, passa adiante
lib/editais.ts                funções PURAS, sem React:
                                limparTitulo, normalizarCaixa, resumir,
                                diasAte, nivelUrgencia, agruparPorPrazo,
                                filtrar
componentes/Radar.tsx         client — estado (busca, fonte, áreas, agora)
componentes/Controles.tsx     barra de busca/áreas/fonte
componentes/GrupoPrazo.tsx    cabeçalho de grupo + lista
componentes/LinhaEdital.tsx   a linha com espinha de data
componentes/SemPrazo.tsx      seção compacta dos 17 sem data
componentes/StatusFontes.tsx  rodapé
```

`lib/editais.ts` concentra toda a lógica de texto e data como funções puras.
Isso espelha a convenção que o projeto já usa no scraper — "parsing separado
do fetch, funções puras para testar offline" (CLAUDE.md) — e mantém cada
componente pequeno o bastante para ser lido de uma vez.

## Mudanças no scraper

### `scraper/fontes/finep.ts` — VIÁVEL, custo zero

Adicionar `prazoProposto` ao schema Zod e usar
`prazoProposto ?? vigenciaFim`. **Nenhuma requisição HTTP extra** — o campo já
vem no mesmo JSON. Ganho: +16 editais com prazo, e correção da data errada
nos 6 que hoje "funcionam".

### `scraper/fontes/fapeg.ts` — VIÁVEL, custo médio

Os 5 PDFs testados tinham texto extraível e seção "CRONOGRAMA" com a data:

```
Limite para Submissão das propostas na Plataforma Sparkx-FAPEG
até às 17:00 horas do dia 10/07/2026
```

Técnica: página individual → link do PDF → `pdf-parse` (JS puro, sem binário
externo) → regex sobre a seção CRONOGRAMA.

Custo: +2 requisições por edital (~+10 por execução) e uma dependência nova.

Riscos conhecidos, a tratar no código:
- Os rótulos variam ("Limite para Submissão das propostas" vs "Limite para
  Inscrições na plataforma SPARKX") — regex tolerante.
- Um edital tinha "CRONOGRAMA" no sumário antes da tabela real — pegar a
  ocorrência seguida de datas, não a do índice.
- Editais com retificação têm 2 PDFs — usar o mais recente.

A arquitetura de fallback existente protege: se a FAPEG falhar, ela reusa os
dados anteriores e é marcada `ok: false`. Uma fonte quebrada nunca apaga
dados.

### CAPES — sem mudança

Ver "CAPES fica sem prazo" acima.

## Testes

Vitest já está configurado (32 testes passando). Acrescentar:

- `tests/editais.test.ts` — as funções puras de `lib/editais.ts`:
  - `limparTitulo` com os padrões reais das 4 fontes, **incluindo o caso em
    que não casa** (devolve intacto)
  - `normalizarCaixa` preservando siglas
  - `nivelUrgencia` nos limites exatos (3, 4, 14, 15 dias) e no passado
  - `agruparPorPrazo` com edital sem prazo e com prazo vencido
- `tests/fontes.test.ts` — estender a fixture da FINEP com um registro que
  tem `prazoProposto` e `vigenciaFim` divergentes, provando que vence o
  `prazoProposto`; e um vencido, provando que sai do radar.
- Fixture nova da FAPEG: texto de PDF real salvo em `tests/fixtures/`, para
  testar a regex do CRONOGRAMA offline.

Sem testes de snapshot visual — o valor está nas funções puras.

## Verificação

1. `npm test` verde.
2. `npm run scrape` real → conferir que FINEP passa de 6 para ~22 editais com
   prazo e que o BRICs mostra 14/08, não 19/11.
3. Conferir que os 6 vencidos da FINEP saíram do radar.
4. `npm run build` compila; a página continua estática (SSG).
5. `npm run dev` → conferir no navegador: agrupamento, espinha de datas,
   escala de urgência, descrição visível, personalização persistindo entre
   recarregamentos, estado vazio, rodapé com erro real de fonte.
6. Conferir no celular (largura ~390px).
7. Conferir dark mode e contraste WCAG AA no texto de corpo.

## Fora de escopo

- OCR dos PDFs da CAPES.
- Fontes novas (FAPESP, EMBRAPII, BNDES).
- Alertas por e-mail/Telegram, RSS.
- Histórico de encerrados (o git já guarda o histórico do JSON).
- Command palette.
