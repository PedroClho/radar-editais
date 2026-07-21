# Auditoria — gaps do Radar de Editais

Data: 2026-07-21

## Método

Seis auditores independentes (frontend/spec, design visual, funcionalidades,
dados/scraper, escrita, organização/CI) + um crítico de completude, com
verificação cruzada manual: screenshots reais do site em 4 combinações
(desktop/mobile × claro/escuro), medições diretas sobre `data/editais.json`
(53 editais) e leitura integral do código. Cada gap tem evidência
`arquivo:linha` ou número medido.

O estado de partida é bom: o redesign de 2026-07-20 foi implementado com
fidelidade, 83 testes passam, `next build` e `eslint` limpos, tipografia
Newsreader/Archivo self-hosted, hidratação tratada com cuidado, fallback de
fontes robusto. Os gaps abaixo são o que separa "bem construído" de
"excelente" — nenhum invalida a direção tomada.

Convenção de IDs: **DAD** dados/scraper · **FUN** funcionalidades ·
**UI** design/interface · **TEC** front técnico · **TXT** escrita ·
**ORG** organização/testes/CI. Severidade: 🔴 alta · 🟡 média · ⚪ baixa.

---

## Escopo 1 — Dados & scraper (DAD)

A matéria-prima do radar. Medições no dataset real de 20/07:
53 editais, 18 sem prazo, 7 vencidos (corretamente ocultados), CNPq e CAPES
com **zero** descrições.

### DAD-1 🔴 Editais mortos de 2017–2025 expostos como vigentes em "Sem prazo divulgado"

A FINEP mantém registros `situacao: 'aberta'` que são lixo histórico:
"COOPERAÇÃO ICT-EMPRESA – 01/2017" (duas variantes), "Finep e Rede Eureka
**2024**", "PROCESSO DE SELEÇÃO Nº 01/**2025**", um item com
`inscricaoInicio` de **2024-07-08**. Sem `inscricaoFim`, a regra "o prazo
manda" não tem prazo para mandar, e o item entra no radar para sempre.
Um professor que abre "Cooperação ICT-Empresa – 01/2017" perde a confiança
no site inteiro.

- Evidência: medição no JSON — 4 títulos com ano ≤2025 entre os 18 sem prazo;
  `scraper/fontes/finep.ts` não lê `dataDePublicacao` nem corta por idade.
- Tratamento: ver spec (usar `dataDePublicacao`/`vigenciaInicio` para
  descartar sem-prazo publicados há mais de N meses; detectar "fluxo
  contínuo" no título/descrição e rotular como tal em vez de "prazo no
  edital").

### DAD-2 🔴 Rótulo "Tecnologia" cobre 70% do dataset — não discrimina nada

`AREAS.tecnologia` contém `inovacao` e `inovador*`. Num agregador de editais
de *fomento à inovação*, praticamente todo edital casa: 37/53 (70%) são
"tecnologia". O rótulo que deveria recortar vira ruído de fundo — e polui a
linha de metadados de quase toda entrada.

- Evidência: medição — distribuição real: tecnologia 37, sustentabilidade 16,
  agro 13, energia 10, geral 10, indústria 9, saúde 6, educação 5;
  `scraper/classificador.ts:58-59`.
- Tratamento: remover `inovacao`/`inovador*` do dicionário de tecnologia
  (são o *gênero* do site, não uma *área*), re-rodar classificação e conferir
  a nova distribuição nos testes.

### DAD-3 🟡 `coletadoEm` é o timestamp da execução, não "primeiro visto" — mata a ordenação de "Sem prazo" e impede "novo desde ontem"

Cada execução regrava `coletadoEm: agora` em todos os editais de fonte
bem-sucedida; `mesclar()` não preserva o valor anterior por `id`. Medido: só
4 valores distintos de `coletadoEm` para 53 editais (um por fonte). A
ordenação documentada da seção "Sem prazo divulgado" ("mais recentemente
visto primeiro") é hoje um empate total dentro de cada fonte, e qualquer
badge "novo" futuro não tem dado para existir.

- Evidência: `scraper/mesclar.ts:23-24` (push direto, sem lookup no
  `anterior`); medição no JSON.
- Tratamento: em `mesclar()`, preservar `coletadoEm` original quando o `id`
  já existia na execução anterior. Isso transforma o campo em "primeiro
  visto" de fato e destrava o badge "novo" (FUN-5).

### DAD-4 🟡 `publicoAlvo` da FINEP é coletado e jogado fora

A API da FINEP entrega `publicoAlvo` (ex.: "Empresas", "ICTs") na mesma
resposta já baixada. Hoje alimenta o classificador e é descartado — não está
no schema nem chega ao front. É exatamente a informação que decide "esse
edital é para mim?" (aluno ≠ empresa ≠ ICT), a custo zero de coleta.

- Evidência: `scraper/fontes/finep.ts:27,45-51` (usado só em `extras`);
  `scraper/schema.ts:6-18` (campo inexistente).
- Tratamento: campo opcional `publicoAlvo?: string[]` no schema, persistir
  na FINEP, exibir como metadado discreto na linha (spec de design).

### DAD-5 🟡 CNPq sem nenhuma descrição — classificação e busca operam só sobre o título

O coletor lê apenas a página de listagem. 0/10 editais do CNPq têm
descrição: a busca textual não tem corpo para buscar, o classificador
decide por meia dúzia de palavras ("Universal" → geral) e o usuário não tem
como saber do que trata sem sair do site.

- Evidência: medição (cobertura desc: finep 36/36, fapeg 5/5, cnpq 0/10,
  capes 0/2); `scraper/fontes/cnpq.ts:15-44` (nunca visita página de
  detalhe).
- Tratamento: visitar a página de cada chamada (~10 requisições/dia, com o
  `buscarTexto` já existente), extrair o primeiro parágrafo como descrição e
  reclassificar com título+descrição. CAPES continua fora (decisão
  documentada na spec de 20/07 — PDFs, um deles escaneado).

### DAD-6 ⚪ Prazo armazenado como `23:59:59Z` expira às 20:59 de Brasília

`fimDoDiaIso`/`dataBrParaIso` marcam fim do dia em UTC. A contagem de dias
usa calendário de São Paulo e fica correta, mas o *instante* de corte real é
3h mais cedo — e `cnpq.ts:37` compara a string ISO bruta para calcular
`situacao`, herdando o desvio. Qualquer consumidor futuro do timestamp
exato (.ics de FUN-4!) herda o erro.

- Evidência: `scraper/util.ts:24-30`; `scraper/fontes/cnpq.ts:37`;
  `lib/editais.ts:169-171` (diasAte por dia de calendário — dias contam
  certo, o corte absoluto não).
- Tratamento: gravar fim do dia com offset explícito de Brasília
  (`T23:59:59-03:00`) nos dois helpers + testes.

### DAD-7 🔴 Descrição da FINEP cortada no meio da palavra em 94% dos casos

`descricao?.slice(0, 400)` sem respeitar palavra nem sinalizar corte.
Medido: 34/36 descrições da FINEP têm exatamente 400 chars e terminam em
fragmento ("...na biod", "...Nesta ed", "...Cidade d"). A FINEP é 68% do
dataset — é o que a maioria vê todo dia. O `resumir()` do front corta de
novo em 180 no limite de palavra, mas quem lê o JSON (e qualquer uso futuro
da cauda do texto) recebe fragmentos.

- Evidência: `scraper/fontes/finep.ts:60`; medição 34/36 no JSON.
- Tratamento: cortar em limite de palavra com "…" no scraper (mesma técnica
  do `resumir()`), e subir o teto para ~600 para dar corpo à busca.

### DAD-8 🟡 `sustentab*` casa "sustentabilidade econômica" — edital de defesa rotulado Sustentabilidade

"Finep Mais Inovação Brasil – Rodada 2 - Base Industrial de Defesa" ganhou
a área sustentabilidade por "Sustentabilidade econômica para Base
Industrial de Defesa". Quem filtra esperando clima/ambiente recebe defesa
nacional.

- Evidência: `scraper/classificador.ts:100`; id finep-75ed62c47d24 no JSON.
- Tratamento: exigir colocação ambiental ("sustentabilidade ambiental/
  climática", "desenvolvimento sustentável") ou excluir a colocação
  "sustentabilidade econômica"; caso ambíguo vira teste.

### DAD-9 🟡 FAPEG baixa o PDF inteiro e classifica sem ele — 60% cai em "geral"

Fora da FINEP a classificação opera só sobre título (+origem): geral% por
fonte = finep 2,8%, cnpq 50%, **fapeg 60%**, capes 50%. O coletor da FAPEG
já baixa o texto completo do PDF para achar o prazo — e joga o texto fora em
vez de reclassificar com ele. Ganho de graça, zero requisição extra.

- Evidência: medição no JSON; `scraper/fontes/fapeg.ts:29` (classifica) vs
  `:121` (baixa o PDF depois).
- Tratamento: `prazoDoPdf` retorna também o texto; reclassificar o edital
  com `titulo + origem + texto do PDF`. CNPq tratado em DAD-5.

### DAD-10 🟡 Duplicata de conteúdo idêntico não é deduplicada

"Programa de Investimento em Startups Inovadoras 2ª Rodada" aparece 2× com
título E descrição idênticos (urls `.../721681` e `.../721708` — registros
duplicados no CMS da FINEP). O dedupe é só por `id` (hash de fonte+url).
Também há o quase-duplicado "COOPERAÇÃO ICT-EMPRESA – 01/2017" / "Finep /
CDTI - COOPERAÇÃO ICT-EMPRESA – 01/2017".

- Evidência: ids finep-a46a444bde24 / finep-eaaefa1a1e42 no JSON;
  `scraper/mesclar.ts:43-48`.
- Tratamento: dedupe secundário por (título normalizado + descrição) no
  `mesclar()`, mantendo o de URL "menor" (estável) + teste.

### DAD-11 ⚪ `situacao` persistida mente para FINEP/FAPEG

Só o CNPq calcula `situacao` pela data; FINEP/FAPEG gravam 'aberto' fixo —
7/53 registros (13%) estão vencidos com `situacao: 'aberto'`. O front
recalcula (decisão consciente), mas qualquer novo consumidor do JSON herda
um campo estruturalmente errado.

- Evidência: `scraper/fontes/finep.ts:66`, `fapeg.ts:36`; medição 7/53.
- Tratamento: normalizar `situacao` a partir de `inscricaoFim` no
  `mesclar()`, para o JSON ser fonte única da verdade.

### DAD-12 ⚪ Flag IA diluída: 2 dos 3 editais `ia:true` só citam IA de passagem

"Prêmio Mulheres Inovadoras" lista IA entre 10 tecnologias; a carta-convite
de defesa, entre 5 linhas temáticas. Para a turma de IA, 2/3 do filtro
central é "menção de passagem". Trade-off inerente ao classificador de
custo zero — registrado; heurística de "lista de 5+ tecnologias" é possível
mas arriscada.

- Evidência: verificação ao vivo na API (o termo só existe após o corte de
  400 chars no JSON — cf. DAD-7).
- Tratamento: aceitar por ora; DAD-7 (descrição maior) já melhora a
  auditabilidade. Registrar como limitação conhecida no README.

---

## Escopo 2 — Funcionalidades & filtros (FUN)

O que preservar: filtros combinam correto (AND entre tipos, OR interno em
áreas), pseudo-área IA bem resolvida, "mostrando X de Y · ver todos" nunca
esconde dados em silêncio, localStorage defensivo.

### FUN-1 🔴 Buscar "IA" devolve 40 dos 53 editais

`filtrar()` casa substring pura: "ia" está dentro de "tecnolog**ia**",
"estratég**ia**", "ciênc**ia**"... O termo de busca mais óbvio do público-alvo
do projeto retorna 75% do dataset em vez dos 3 editais de IA.

- Evidência: `lib/editais.ts:232-233`; medido contra o JSON real: 40/53
  casam com "ia" vs 3/53 com flag `ia === true`.
- Tratamento: termo curto (≤3 chars) casa por palavra inteira (fronteira
  Unicode); busca normalizada exatamente igual a "ia" também considera a
  flag `e.ia`. Testes com "ia", "IoT" e termo longo.

### FUN-2 🟡 Área órfã no localStorage vira filtro invisível

`lerAreas()` não valida contra as áreas existentes. Área salva que sumiu do
dataset (renomeada, zero itens hoje) continua filtrando, mas nenhum botão
aparece marcado — o usuário vê menos editais sem nenhuma pista do porquê.

- Evidência: `lib/preferencias.ts:5-15`; `componentes/Radar.tsx:40-54` +
  render dos botões só para `areasDisponiveis`.
- Tratamento: sanear na leitura contra `Object.keys(AREAS) + 'ia'` e
  persistir a lista limpa.

### FUN-3 🟡 Nenhum sinal de frescor acima da dobra

O mockup da spec de 20/07 traz "atualizado hoje" na primeira linha; o código
não usa `dados.atualizadoEm` em lugar nenhum visível além do rodapé (após
~6.500px de rolagem). Se o GitHub Action parar em silêncio, nada no topo
avisa.

- Evidência: `componentes/Radar.tsx:77-90`; spec linha 138.
- Tratamento: "atualizado hoje/ontem/há N dias" no cabeçalho, com cor de
  alerta quando >36h (Action falhou = dado envelhecendo).

### FUN-4 🟡 Prazo não vira compromisso — sem exportar para calendário

Decidiu "vou submeter"? O site não oferece nada entre a decisão e a agenda
pessoal do usuário. Um `.ics` por edital é gerável 100% client-side
(data URI), sem dependência, e fecha o ciclo que a faixa de urgência começa.

- Evidência: `componentes/LinhaEdital.tsx:72-144` (única ação é abrir o
  edital); não está no "fora de escopo" da spec de 20/07.
- Tratamento: função pura `gerarIcs(edital)` em `lib/` + ação secundária
  discreta na linha (spec de design resolve o conflito de link-dentro-de-link).

### FUN-5 🟡 "O que mudou desde ontem?" — sem badge "novo"

Público que volta todo dia não tem como ver o que apareceu desde a última
visita. Depende de DAD-3 (primeiro-visto real). Com ele, um marcador "novo"
para editais com `coletadoEm` ≤ 7 dias é barato e de alto valor.

- Evidência: dependência DAD-3; nenhum mecanismo atual.
- Tratamento: badge discreto na linha (spec de design), derivado de
  `coletadoEm` corrigido.

### FUN-6 ⚪ Filtro não vira URL compartilhável

Busca/área/fonte vivem só em `useState`. "Olha os editais de IA fechando
esta semana" não tem link — numa turma que se comunica por link, é fricção
real.

- Evidência: `componentes/Radar.tsx:18-20`.
- Tratamento: sincronizar filtros com query string (replace, sem scroll),
  inicializando o estado a partir da URL.

---

## Escopo 3 — Design & interface (UI)

O que preservar: par Newsreader/Archivo aplicado com disciplina real,
hairlines sem nenhum resquício de card/sombra/raio grande, cor de urgência
restrita ao texto da data (7:1 e 6,5:1 de contraste, medidos), tabular-nums
consistente, IBM Plex Mono realmente eliminado.

### UI-1 🔴 A busca é invisível no desktop

O input tem `flex-1 min-w-0` na barra `sm:flex-row`; com 9 áreas + select de
fonte ocupando a linha, sobra 0px de espaço livre e o input colapsa a
largura zero. Em 1440px de tela, **não existe busca visível nem clicável** —
só no mobile (layout em coluna) ela aparece.

- Evidência: screenshot desktop 1440px (barra começa em "áreas IA
  Tecnologia..."); `componentes/Controles.tsx:31-39`.
- Tratamento: spec de design — reorganizar a barra de controles com largura
  mínima real para a busca.

### UI-2 🟡 Sem favicon nem imagem OG — o site não tem rosto

`app/` não tem `icon.*` nem `opengraph-image.*`; a aba mostra o globo
genérico e o link compartilhado no WhatsApp da turma vem sem card (ver
TXT-7). Para uma ferramenta de uso diário, a aba sem ícone é literalmente
mais difícil de achar.

- Evidência: `ls app/` — só `favicon.ico` ausente/globals/layout/page;
  metadata sem `openGraph`.
- Tratamento: `app/icon.svg` (marca do radar) + `app/opengraph-image.tsx`
  (`ImageResponse`, estático no build) + bloco `openGraph`/`twitter` no
  metadata.

### UI-3 🟡 "Esta semana" vazio desaparece — a pergunta nº 1 fica sem resposta

O job da página é "o que fecha logo?". Hoje (21/07) nada fecha em ≤7 dias e
o grupo simplesmente não renderiza — a página abre em "PRÓXIMAS SEMANAS" e a
resposta "nada fecha esta semana, respira" fica implícita. Ausência de
grupo ≠ resposta; para quem volta todo dia, a confirmação explícita é o
produto.

- Evidência: screenshot de hoje (primeira seção visível: "Próximas
  semanas"); `componentes/GrupoPrazo.tsx:13` (`if (editais.length === 0)
  return null`).
- Tratamento: "Esta semana" sempre visível quando não há filtro ativo, com
  estado vazio de uma linha ("nenhum prazo fecha esta semana").

### UI-4 🔴 Contador de itens do grupo com contraste 1,2:1 — invisível

O número ao lado de "PRÓXIMAS SEMANAS" usa `text-[var(--line)]` — a cor da
hairline decorativa. Medido: 1,22:1 no claro, 1,35:1 no escuro, contra piso
AA de 4,5:1. Informação real (quantos itens), sem `aria-hidden`, ilegível
para qualquer pessoa com baixa visão.

- Evidência: `componentes/GrupoPrazo.tsx:18`; `componentes/Radar.tsx:132`;
  contraste calculado dos hex declarados.
- Tratamento: `text-[var(--muted)]` (4,95:1 / 6,9:1) — hierarquia mantida,
  informação legível.

### UI-5 🟡 Cabeçalhos de grupo ainda são CAIXA ALTA + cinza apagado

Contestação de decisão da spec de 20/07: a tabela de anti-padrões declarou
"Labels em CAIXA ALTA + cinza claro" resolvido ao eliminar o monospace —
mas `text-xs tracking-wider uppercase text-[var(--muted)]` continua em todo
cabeçalho de grupo. É a assinatura mais óbvia de "dashboard genérico",
independente da família tipográfica.

- Evidência: `componentes/GrupoPrazo.tsx:16`; `componentes/Radar.tsx:130`.
- Tratamento: spec de design — cabeçalhos editoriais (Newsreader itálico,
  caixa de frase), o que também resolve TEC-2 pelo uso.

### UI-6 🟡 Linha inteira clicável sem nenhum feedback de hover além do sublinhado

`--surface` (token órfão de TEC-4) tem os valores exatos de um fundo de
hover que nunca foi ligado. Numa lista densa de 30+ linhas, o cursor não
recebe confirmação de qual linha está ativa.

- Evidência: `componentes/LinhaEdital.tsx:74-100` (só `group-hover:underline`
  no h3); `app/globals.css:5,17`.
- Tratamento: feedback de linha inteira no hover (fundo `--surface` ou
  intensificação da espinha de data) — decisão fina na spec de design.

### UI-7 🟡 Botões de área sem padding — alvo de toque abaixo de 24px no celular

Botões só-texto em `text-sm` com `gap-y-1`: caixa de toque ~20px, abaixo do
mínimo WCAG 2.2 (24×24) e longe dos 44pt/48dp das diretrizes móveis. A spec
de 20/07 pede verificação em 390px; com 8-9 áreas em 2 linhas apertadas, o
toque errado é frequente.

- Evidência: `componentes/Controles.tsx:50-63`.
- Tratamento: `py-1 -my-1` (caixa maior sem alterar ritmo visual) ou
  redesenho da barra (spec de design).

### UI-8 ⚪ Zero transições CSS — o reduced-motion protege nada

A única ocorrência de `transition` no projeto é o `transition: none` do
bloco `prefers-reduced-motion`. Os 3 hovers existentes trocam cor
instantaneamente — interação mais brusca que o cuidado do resto do sistema.

- Evidência: grep: só `app/globals.css:55`.
- Tratamento: `transition-colors duration-150` nos interativos (spec de
  design inclui também transições de filtragem via View Transitions).

### UI-9 ⚪ `--muted` no claro passa AA com margem de 0,45

4,95:1 sobre `--bg` claro (piso 4,5) vs 6,9:1 no escuro. É a cor mais usada
do sistema; qualquer ajuste futuro de fundo derruba o modo claro abaixo de
AA em silêncio.

- Evidência: `app/globals.css:7-8`; contraste calculado.
- Tratamento: escurecer levemente (ex.: `#62666d`, ~5,3:1).

### UI-10 ⚪ Sem `themeColor` — barra do navegador móvel não acompanha o tema

Nenhum export `viewport`; no escuro, página quase preta com chrome claro do
navegador.

- Evidência: `app/layout.tsx` (sem export viewport);
  `generate-viewport.md` nas docs do Next 16 instalado confirma a API.
- Tratamento: `export const viewport` com `themeColor` por
  `prefers-color-scheme`.

---

## Escopo 4 — Front-end técnico (TEC)

O que preservar: hidratação tratada com `agoraMs` inicial determinístico,
funções puras concentradas em `lib/editais.ts`, foco visível global,
`prefers-reduced-motion` respeitado.

### TEC-1 🟡 `app/page.tsx` faz cast cego do JSON que o pipeline escreve sem revisão humana

`dadosJson as unknown as Dados` — o projeto tem `DadosSchema` (Zod) e o usa
no scraper, mas o ponto onde o front consome o arquivo confia de graça. Um
bug do scraper vira crash no navegador em vez de build quebrado com
mensagem clara.

- Evidência: `app/page.tsx:5` vs `scraper/index.ts:20-23`.
- Tratamento: `DadosSchema.parse(dadosJson)` em `page.tsx` (SSG: falha no
  build, nunca no cliente).

### TEC-2 🟡 Variante itálica do Newsreader: 64KB pré-carregados, uso zero

`style: ['normal', 'italic']` gera preload de ~64KB de woff2 itálico (40% do
peso de fontes) sem nenhum uso no código.

- Evidência: `app/layout.tsx:14`; grep "italic" em componentes/app = 0
  ocorrências; preload no HTML gerado.
- Tratamento: a spec de design **passa a usar** o itálico (cabeçalhos de
  grupo editoriais) — o gap se resolve por uso; se a spec cair, remover a
  variante.

### TEC-3 ⚪ Seção "Sem prazo" duplica `GrupoPrazo` na mão — com bug de espaçamento reproduzível

`Radar.tsx:128-142` reimplementa o JSX de `GrupoPrazo` sem o `first:mt-8`.
Filtrar por CAPES (2 editais, ambos sem prazo) deixa "Sem prazo divulgado"
como primeira seção com margem errada.

- Evidência: `componentes/Radar.tsx:128-142` vs
  `componentes/GrupoPrazo.tsx:14-26`.
- Tratamento: reutilizar `GrupoPrazo` (ou extrair `SemPrazo.tsx` como a spec
  de 20/07 previa).

### TEC-4 ⚪ Token `--surface` órfão

Definido nos dois temas, referenciado em lugar nenhum — mesmo padrão que a
spec de 20/07 mandou remover para `--accent-suave`.

- Evidência: `app/globals.css:5,17`; grep sem ocorrências de uso.
- Tratamento: usar de verdade (spec de design: barra de controles fixa) ou
  remover.

### TEC-5 ⚪ Lógica de `areasDisponiveis` inline no componente, sem teste

Contagem/ordenação por frequência + pseudo-área IA decidem a ordem dos
filtros que o usuário vê todo dia; vivem num `useMemo` sem teste, contra a
convenção do projeto (funções puras em `lib/`).

- Evidência: `componentes/Radar.tsx:40-54`; nenhum teste equivalente.
- Tratamento: extrair `listarAreasDisponiveis()` para `lib/editais.ts` +
  testes (frequência, IA primeiro, geral excluído).

---

## Escopo 5 — Escrita & microcopy (TXT)

O que preservar: terminologia "edital" estável, pluralização tratada na
maioria das strings, estados de erro/vazio fiéis à spec, ~94% dos títulos
reais saindo limpos.

### TXT-1 🔴 `limparTitulo` falha exatamente nos 3 piores títulos do dataset

`RE_CHAMADA` exige abertura literal "Chamada", órgão de um token e "nº" logo
em seguida. Falham: (1) "**Chamamento Público** CNPq/FNDCT/MCTI Nº 01/2026
Para Participação..." — 137 caracteres, o *máximo* medido que justificou a
função na spec; (2) "Chamada Pública MCTI/CNPq/MIR/MMulheres/MPI Nº 20/2026
**Atlânticas** - Programa Beatriz Nascimento..." (palavra entre número e
traço); (3) "Chamada Pública para Envio de Proposta de Curso Novo - Edital
nº 20/2026" (nº no fim, padrão CAPES).

- Evidência: `lib/editais.ts:8-9`; ids cnpq-453d3c7f1ca1, cnpq-1941baf2f023,
  capes-7730401430fb no JSON real; nenhum dos 3 padrões em teste.
- Tratamento: aceitar "chamada|chamamento", localizar `nº N/AAAA` em
  qualquer posição antes do separador e tratar sufixo "- Edital nº X" como
  referência. Os 3 títulos reais viram casos de teste.

### TXT-2 🟡 Descrição que repete o título gasta o line-clamp com redundância

Em ≥2 editais da FINEP a descrição começa repetindo o título inteiro; as 2
linhas visíveis mostram duas vezes o que o H3 acabou de dizer e cortam a
informação nova.

- Evidência: finep-993d4cf93d47, finep-0523bacf004a no JSON;
  `lib/editais.ts:143-149` não deduplica.
- Tratamento: em `resumir()` (ou antes dela), remover prefixo igual ao
  título (comparação normalizada) antes de truncar.

### TXT-3 🟡 "1 abertos" — contador do topo sem singular

`{vigentes.length} abertos` sem tratamento, na mesma tela em que
`fecha/fecham` já resolve o mesmo problema duas linhas abaixo.

- Evidência: `componentes/Radar.tsx:80` vs `:85`.
- Tratamento: `aberto/abertos` + caso de teste.

### TXT-4 🟡 Sigla real "EFPC" vira palavra falsa "Efpc"

Título da FINEP termina em "- EFPC"; fora de composto com `/` ou `-` interno
o token não é reconhecido como sigla e é capitalizado.

- Evidência: `lib/editais.ts:36-66,74-84`; finep-127d235d1a16 no JSON.
- Tratamento: adicionar EFPC à lista curada `SIGLAS` (manutenção prevista
  pelo próprio comentário da lista).

### TXT-5 ⚪ Rótulo visível "áreas" divergente do aria-label "Minhas áreas"

A spec definiu "minhas áreas" como parte do significado (filtro que
persiste); leitor de tela ouve uma coisa, a tela mostra outra.

- Evidência: `componentes/Controles.tsx:44` vs `:46`; spec linha 140.
- Tratamento: texto visível "minhas áreas".

### TXT-6 ⚪ README desatualizado sobre a FAPEG

"→ tabela de inscrições abertas" omite a extração de prazo dos PDFs
(cronograma), um dos dois ganhos centrais do redesign de 20/07.

- Evidência: `README.md:16`; grep "PDF" no README = 0.
- Tratamento: atualizar a linha do diagrama.

### TXT-7 🟡 Sem Open Graph/Twitter Card — link compartilhado vira texto puro

O público troca links por WhatsApp; sem `openGraph` no metadata, não há
card. Textos já existem, custo ~zero (imagem em UI-2).

- Evidência: `app/layout.tsx:18-22`.
- Tratamento: bloco `openGraph` + `twitter` reusando title/description +
  imagem de UI-2.

---

## Escopo 6 — Organização, testes & CI (ORG)

O que preservar: 83 testes bem direcionados (limites 3/4/14/15 exatos,
casos reais do dataset), docs que se autodeclararam superadas apontando a
vigente, nomenclatura PT/EN consistente e intencional, workflow roda testes
antes de publicar dados.

### ORG-1 🟡 Nenhum CI de qualidade em push/PR — só o cron diário

Commit direto em `main` com erro de tipo/lint só é pego pelo build da
Vercel, fora do repo. O único workflow é o cron de scrape (que roda testes,
mas apenas 1x/dia e no caminho de dados).

- Evidência: `.github/workflows/` só tem `atualiza-editais.yml`.
- Tratamento: `ci.yml` em push/PR: `npm test` + `npm run lint` +
  `tsc --noEmit` + `npm run build`.

### ORG-2 🟡 `scraper/http.ts` — o guarda anti-página-de-manutenção — sem nenhum teste

Retry ×3 e o callback `validar` são as "pegadinhas confirmadas" do recon;
um refactor que os quebre só aparece em produção no cron.

- Evidência: `scraper/http.ts:1-41`; grep em `tests/` = 0 usos.
- Tratamento: `tests/http.test.ts` com fetch mockado (sucesso após falhas,
  esgotar tentativas, validar rejeitando manutenção com HTTP 200).

### ORG-3 🟡 Limites 7/8/30/31 do agrupamento sem teste de fronteira

`nivelUrgencia` tem testes exatos nos limites; `agruparPorPrazo` decide o
grupo com `<=7`/`<=30` testado só com valores folgados (5/21/>30).

- Evidência: `lib/editais.ts:206-208`; `tests/editais.test.ts:209-223`.
- Tratamento: casos em exatamente 7, 8, 30 e 31 dias.

### ORG-4 ⚪ Cron sem `timeout-minutes`

Default de 360 min; um parser de PDF pendurado consome horas de Actions em
vez de falhar visível.

- Evidência: `.github/workflows/atualiza-editais.yml:12-14`.
- Tratamento: `timeout-minutes: 10`.

### ORG-5 ⚪ Área "sustentabilidade" nunca exercida em teste

Última área adicionada ao dicionário, zero cobertura — um regex mal escapado
passaria.

- Evidência: `scraper/classificador.ts:99-110`; grep "sustentab" nos testes = 0.
- Tratamento: caso real no `tests/classificador.test.ts`.

### ORG-6 ⚪ Higiene: 5 SVGs órfãos do scaffold + docs com pontas soltas

`public/{file,globe,next,vercel,window}.svg` sem nenhuma referência; spec de
20/07 cita `SemPrazo.tsx` que virou código inline (ver TEC-3); plano de
20/07 com checkboxes todos abertos apesar de implementado.

- Evidência: grep sem referências; `git log` com commits das tasks.
- Tratamento: remover SVGs; nota curta na spec antiga; marcar plano como
  concluído.

---

## Escopo 7 — Ângulos do crítico de completude (CRIT)

Um sétimo agente revisou o conjunto: verificou 10 evidências por amostragem
(10/10 conferem), apontou 2 duplicatas entre auditores (consolidadas acima)
e 6 ângulos que ninguém cobriu. Adotados:

### CRIT-1 🟡 SEO técnico zero: sem robots.txt, sitemap ou `metadataBase`

Site público que professores podem descobrir via busca; custo ~zero com as
convenções do Next (`app/robots.ts`, `app/sitemap.ts`, `metadataBase`).

### CRIT-2 🟡 Sem manifest PWA — "ferramenta de quem volta todo dia" sem "adicionar à tela inicial"

`app/manifest.ts` + ícones (que UI-2 já cria) dão o atalho de celular que o
público declarado usaria. Sem service worker/offline — só o manifest.

### CRIT-3 🟡 Urgência sinalizada só por cor na data

`--critico` e `--accent-forte` são tons próximos para protanopia/
deuteranopia, e a própria pesquisa citada na spec de 20/07 (NN/g) manda
acompanhar cor de sinal não-cromático. O texto "faltam N dias" mitiga; a
data em si não.

- Tratamento: peso tipográfico diferencial no crítico (≤3 dias:
  `font-semibold`) + nó da espinha (posição/forma) — cor nunca sozinha.

### CRIT-4 ⚪ Cron sem `concurrency` nem rebase antes do push

Disparo manual durante o cron = push non-fast-forward sem retry.

- Tratamento: bloco `concurrency` no workflow + `git pull --rebase` antes
  do push.

### Registrados, não adotados

- **LICENSE ausente** no repo público: decisão de direitos é do Pedro —
  fica anotado (sugestão: MIT), sem implementar.
- **@media print**: o próprio crítico recomenda não priorizar.
