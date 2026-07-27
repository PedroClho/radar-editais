import { describe, expect, test } from 'vitest'
import {
  agruparPorPrazo,
  contarFacetas,
  diasAte,
  filtrar,
  frescor,
  janelaInscricao,
  limparTitulo,
  listarAreasDisponiveis,
  nivelUrgencia,
  normalizarCaixa,
  ordenarEditais,
  resumir,
  separarOrigem,
  tirarPrefixoDeTitulo,
} from '../lib/editais'
import type { Edital } from '../scraper/schema'

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

  // Achados ao rodar os 53 editais reais pelas funções: o grupo do órgão
  // capturava a palavra errada quando o título não nomeia órgão nenhum.
  test('não inventa órgão quando o título não tem um', () => {
    const r = limparTitulo(
      'Chamada Pública nº 11/2026 — Legado Verdes do Cerrado - 2ª Edição',
    )
    expect(r.titulo).toBe('Legado Verdes do Cerrado - 2ª Edição')
    expect(r.referencia).toBe('nº 11/2026')
  })

  test('descarta palavra comum capturada no lugar do órgão', () => {
    const r = limparTitulo(
      'Chamada Pública Complementar nº 12/2026 — EDITAL COMPLEMENTAR À CHAMADA ERC-CONFAP 2026',
    )
    expect(r.referencia).toBe('nº 12/2026')
  })

  test('mantém o órgão quando ele é de fato uma sigla', () => {
    expect(
      limparTitulo('Chamada CNPq/MCTI nº 25/2026 - Endometriose').referencia,
    ).toBe('CNPq/MCTI nº 25/2026')
  })

  test('não corta quando sobraria um título vazio', () => {
    const so = 'Chamada CNPq nº 06/2026 - '
    expect(limparTitulo(so).titulo).toBe(so)
  })

  // Os 3 títulos reais do dataset que escapavam da primeira versão — o
  // primeiro tem 137 caracteres, exatamente o máximo que motivou a função.
  test('aceita "Chamamento Público" e assunto sem separador após o número', () => {
    const r = limparTitulo(
      'Chamamento Público CNPq/FNDCT/MCTI Nº 01/2026 Para Participação no Programa de Apoio à Popularização da Ciência nas Unidades da Federação',
    )
    expect(r.titulo).toBe(
      'Participação no Programa de Apoio à Popularização da Ciência nas Unidades da Federação',
    )
    expect(r.referencia).toBe('CNPq/FNDCT/MCTI nº 01/2026')
  })

  test('aceita palavra entre o número e o traço', () => {
    const r = limparTitulo(
      'Chamada Pública MCTI/CNPq/MIR/MMulheres/MPI Nº 20/2026 Atlânticas - Programa Beatriz Nascimento de Mulheres na Ciência',
    )
    expect(r.titulo).toBe(
      'Atlânticas - Programa Beatriz Nascimento de Mulheres na Ciência',
    )
    expect(r.referencia).toBe('MCTI/CNPq/MIR/MMulheres/MPI nº 20/2026')
  })

  test('padrão CAPES: referência no fim do título', () => {
    const r = limparTitulo(
      'Chamada Pública para Envio de Proposta de Curso Novo - Edital nº 20/2026',
    )
    expect(r.titulo).toBe('Envio de Proposta de Curso Novo')
    expect(r.referencia).toBe('nº 20/2026')
  })
})

describe('tirarPrefixoDeTitulo', () => {
  test('remove a repetição do título no início da descrição', () => {
    // Caso real da FINEP: a descrição abre repetindo o título inteiro.
    const titulo = 'Finep Mais Inovação Brasil - Rodada 2 – Tecnologias Digitais'
    const descricao = `${titulo} Esta Seleção Pública objetiva conceder recursos`
    expect(tirarPrefixoDeTitulo(descricao, titulo)).toBe(
      'Esta Seleção Pública objetiva conceder recursos',
    )
  })

  test('compara sem acento e sem caixa', () => {
    expect(
      tirarPrefixoDeTitulo('EDUCAÇÃO ESPECIAL: o programa apoia', 'Educacao Especial'),
    ).toBe('o programa apoia')
  })

  test('descrição sem o prefixo passa intacta', () => {
    expect(tirarPrefixoDeTitulo('Outra coisa qualquer', 'Título')).toBe(
      'Outra coisa qualquer',
    )
  })

  test('não devolve vazio quando a descrição É só o título', () => {
    expect(tirarPrefixoDeTitulo('Mesmo Texto', 'Mesmo Texto')).toBe('Mesmo Texto')
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

  // Achados ao rodar os 53 editais reais: siglas fora de composto com barra
  // viravam "Mcti", "Erc-confap".
  test('preserva sigla de agência solta no meio do texto gritado', () => {
    expect(normalizarCaixa('MANUTENÇÃO UNIDADES DE PESQUISA MCTI')).toBe(
      'Manutenção Unidades de Pesquisa MCTI',
    )
  })

  test('preserva sigla dentro de composto com hífen', () => {
    expect(normalizarCaixa('EDITAL COMPLEMENTAR À CHAMADA ERC-CONFAP 2026')).toBe(
      'Edital Complementar à Chamada ERC-CONFAP 2026',
    )
  })

  test('em composto com hífen, só a parte que é sigla resiste', () => {
    expect(normalizarCaixa('COOPERAÇÃO ICT-EMPRESA NACIONAL')).toBe(
      'Cooperação ICT-Empresa Nacional',
    )
  })

  test('não estraga símbolo de moeda no modo frase', () => {
    expect(
      normalizarCaixa('FATURAMENTO ANUAL ATÉ R$ 16 MILHÕES DE REAIS', 'frase'),
    ).toBe('Faturamento anual até R$ 16 milhões de reais')
  })
})

describe('separarOrigem', () => {
  // A FAPEG entrega a coluna "Origem" da tabela no campo de descrição. É
  // informação útil (co-financiadores), mas no lugar errado: ocupa a linha da
  // descrição sem descrever nada.
  test('reconhece "Origem:" e devolve como metadado, não como descrição', () => {
    expect(separarOrigem('Origem: Fapeg/CBC/Votorantim')).toEqual({
      origem: 'Fapeg/CBC/Votorantim',
    })
  })

  test('descrição de verdade passa intacta', () => {
    const real = 'Selecionar propostas para concessão de apoio financeiro'
    expect(separarOrigem(real)).toEqual({ texto: real })
  })

  test('sem descrição devolve objeto vazio', () => {
    expect(separarOrigem(undefined)).toEqual({})
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

  test('fronteiras exatas dos grupos: 7/8 e 30/31 dias', () => {
    // AGORA é 2026-07-20 (09:00 em São Paulo).
    const g = agruparPorPrazo(
      [
        edital({ id: 'd7', inscricaoFim: '2026-07-27T23:59:59.000-03:00' }),
        edital({ id: 'd8', inscricaoFim: '2026-07-28T23:59:59.000-03:00' }),
        edital({ id: 'd30', inscricaoFim: '2026-08-19T23:59:59.000-03:00' }),
        edital({ id: 'd31', inscricaoFim: '2026-08-20T23:59:59.000-03:00' }),
      ],
      AGORA,
    )
    expect(g.estaSemana.map((e) => e.id)).toEqual(['d7'])
    expect(g.proximasSemanas.map((e) => e.id)).toEqual(['d8', 'd30'])
    expect(g.maisAdiante.map((e) => e.id)).toEqual(['d31'])
  })
})

describe('listarAreasDisponiveis', () => {
  test('ordena por frequência, exclui geral e põe IA na frente', () => {
    const lista = [
      edital({ id: 'a', areas: ['saude'], ia: true }),
      edital({ id: 'b', areas: ['saude', 'agro'] }),
      edital({ id: 'c', areas: ['agro'] }),
      edital({ id: 'd', areas: ['agro'] }),
      edital({ id: 'e', areas: ['geral'] }),
    ]
    expect(listarAreasDisponiveis(lista)).toEqual(['ia', 'agro', 'saude'])
  })

  test('sem nenhum edital de IA a pseudo-área não aparece', () => {
    expect(listarAreasDisponiveis([edital({ areas: ['saude'] })])).toEqual([
      'saude',
    ])
  })
})

describe('frescor', () => {
  test('hoje, ontem e há N dias — em dias de calendário de São Paulo', () => {
    expect(frescor('2026-07-20T08:00:00.000Z', AGORA)).toEqual({
      texto: 'atualizado hoje',
      velho: false,
    })
    expect(frescor('2026-07-19T08:00:00.000Z', AGORA)).toEqual({
      texto: 'atualizado ontem',
      velho: false,
    })
    expect(frescor('2026-07-15T08:00:00.000Z', AGORA)).toEqual({
      texto: 'atualizado há 5 dias',
      velho: true,
    })
  })
})

describe('filtrar', () => {
  const lista = [
    edital({ id: 'saude', areas: ['saude'], titulo: 'Endometriose' }),
    edital({ id: 'agro', areas: ['agro'], fonte: 'finep', titulo: 'Milho' }),
  ]

  test('sem filtro devolve tudo', () => {
    expect(filtrar(lista, { busca: '', fontes: [], areas: [], prazo: null }, AGORA)).toHaveLength(2)
  })

  test('busca ignora acento e caixa', () => {
    const r = filtrar(lista, { busca: 'ENDOMETRIOSE', fontes: [], areas: [], prazo: null }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['saude'])
  })

  test('áreas funcionam como OU', () => {
    const r = filtrar(lista, { busca: '', fontes: [], areas: ['saude', 'agro'], prazo: null }, AGORA)
    expect(r).toHaveLength(2)
  })

  test('fonte e área se combinam como E', () => {
    const r = filtrar(lista, { busca: '', fontes: ['finep'], areas: ['saude'], prazo: null }, AGORA)
    expect(r).toHaveLength(0)
  })

  // O classificador mantém IA como flag booleana de propósito (é transversal:
  // um edital de saúde pode ser de IA), então "ia" nunca aparece em areas[].
  // Sem tratamento especial aqui, IA fica impossível de filtrar na interface.
  test('"ia" filtra pela flag, não pelo array de áreas', () => {
    const comIA = [
      edital({ id: 'ia-saude', areas: ['saude'], ia: true }),
      edital({ id: 'so-saude', areas: ['saude'], ia: false }),
    ]
    const r = filtrar(comIA, { busca: '', fontes: [], areas: ['ia'], prazo: null }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['ia-saude'])
  })

  test('"ia" combina com outra área como OU', () => {
    const mix = [
      edital({ id: 'ia-agro', areas: ['agro'], ia: true }),
      edital({ id: 'saude', areas: ['saude'], ia: false }),
      edital({ id: 'energia', areas: ['energia'], ia: false }),
    ]
    const r = filtrar(mix, { busca: '', fontes: [], areas: ['ia', 'saude'], prazo: null }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['ia-agro', 'saude'])
  })

  // Buscar "ia" por substring devolvia 40 dos 53 editais reais (tecnologIA,
  // estratégIA, ciêncIA...) — 75% do dataset na busca mais óbvia do público.
  test('busca curta casa palavra inteira, não substring', () => {
    const mix = [
      edital({ id: 'tec', titulo: 'Apoio à tecnologia nacional' }),
      edital({ id: 'ia-titulo', titulo: 'Bolsas para projetos de IA' }),
    ]
    const r = filtrar(mix, { busca: 'ia', fontes: [], areas: [], prazo: null }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['ia-titulo'])
  })

  test('busca "ia" também alcança editais com a flag, mesmo sem a palavra', () => {
    const mix = [
      edital({ id: 'flag', titulo: 'Aprendizado de máquina na saúde', ia: true }),
      edital({ id: 'nada', titulo: 'Estratégia industrial' }),
    ]
    const r = filtrar(mix, { busca: 'IA', fontes: [], areas: [], prazo: null }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['flag'])
  })

  test('busca curta que não é "ia" segue palavra inteira: iot', () => {
    const mix = [
      edital({ id: 'iot', titulo: 'Chamada IoT para cidades' }),
      edital({ id: 'riot', titulo: 'Programa Riotec' }),
    ]
    const r = filtrar(mix, { busca: 'iot', fontes: [], areas: [], prazo: null }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['iot'])
  })

  test('busca longa continua por substring', () => {
    const r = filtrar(
      [edital({ id: 'endo', titulo: 'Pesquisas em Endometriose' })],
      { busca: 'endometr', fontes: [], areas: [], prazo: null },
      AGORA,
    )
    expect(r.map((e) => e.id)).toEqual(['endo'])
  })
})

describe('janelaInscricao', () => {
  test('devolve a fração do período que ainda resta', () => {
    // Janela de 10 dias com o agora exatamente no meio: restam 50%.
    const e = edital({
      inscricaoInicio: '2026-07-15T12:00:00.000Z',
      inscricaoFim: '2026-07-25T12:00:00.000Z',
    })
    expect(janelaInscricao(e, AGORA)?.pctRestante).toBeCloseTo(0.5, 5)
  })

  test('sem início não há janela — a barra mentiria sobre o período', () => {
    const e = edital({ inscricaoFim: '2026-07-26T00:00:00.000Z' })
    expect(janelaInscricao(e, AGORA)).toBeNull()
  })

  test('sem fim não há janela', () => {
    const e = edital({ inscricaoInicio: '2026-07-16T00:00:00.000Z' })
    expect(janelaInscricao(e, AGORA)).toBeNull()
  })

  test('prazo vencido satura em zero, nunca negativo', () => {
    const e = edital({
      inscricaoInicio: '2026-07-01T00:00:00.000Z',
      inscricaoFim: '2026-07-10T00:00:00.000Z',
    })
    expect(janelaInscricao(e, AGORA)?.pctRestante).toBe(0)
  })

  test('período que ainda nem abriu satura em um', () => {
    const e = edital({
      inscricaoInicio: '2026-08-01T00:00:00.000Z',
      inscricaoFim: '2026-08-30T00:00:00.000Z',
    })
    expect(janelaInscricao(e, AGORA)?.pctRestante).toBe(1)
  })

  // A FINEP publica editais com início e fim no mesmo instante; dividir pela
  // duração levaria a NaN e a barra sumiria sem explicação.
  test('janela de duração zero não vira NaN', () => {
    const e = edital({
      inscricaoInicio: '2026-07-26T00:00:00.000Z',
      inscricaoFim: '2026-07-26T00:00:00.000Z',
    })
    const j = janelaInscricao(e, AGORA)
    expect(j?.pctRestante).toBe(1)
    expect(Number.isNaN(j?.pctRestante)).toBe(false)
  })
})

describe('ordenarEditais', () => {
  const lista = [
    edital({ id: 'longe', inscricaoFim: '2026-09-20T23:59:59.000Z' }),
    edital({ id: 'sem' }),
    edital({ id: 'perto', inscricaoFim: '2026-07-22T23:59:59.000Z' }),
  ]

  test('por prazo: mais apertado primeiro, sem prazo por último', () => {
    const r = ordenarEditais(lista, 'prazo', AGORA)
    expect(r.map((e) => e.id)).toEqual(['perto', 'longe', 'sem'])
  })

  test('não muta o array recebido', () => {
    const antes = lista.map((e) => e.id)
    ordenarEditais(lista, 'prazo', AGORA)
    expect(lista.map((e) => e.id)).toEqual(antes)
  })

  test('por janela: quem tem menos período restante primeiro', () => {
    const comJanela = [
      edital({
        id: 'folgado',
        inscricaoInicio: '2026-07-19T00:00:00.000Z',
        inscricaoFim: '2026-08-19T00:00:00.000Z',
      }),
      edital({
        id: 'acabando',
        inscricaoInicio: '2026-01-01T00:00:00.000Z',
        inscricaoFim: '2026-07-22T00:00:00.000Z',
      }),
    ]
    expect(ordenarEditais(comJanela, 'janela', AGORA).map((e) => e.id)).toEqual([
      'acabando',
      'folgado',
    ])
  })

  // Ordenar por janela não pode esconder quem não tem janela: eles vão ao
  // fim, mas continuam na lista.
  test('por janela mantém quem não tem janela, no fim', () => {
    const r = ordenarEditais(lista, 'janela', AGORA)
    expect(r).toHaveLength(3)
    expect(r.at(-1)?.id).toBe('sem')
  })
})

describe('filtrar por faixa de prazo', () => {
  const lista = [
    edital({ id: 'urgente', inscricaoFim: '2026-07-24T23:59:59.000Z' }),
    edital({ id: 'mes', inscricaoFim: '2026-08-14T23:59:59.000Z' }),
    edital({ id: 'longe', inscricaoFim: '2026-11-14T23:59:59.000Z' }),
    edital({ id: 'sem' }),
  ]
  const vazio = { busca: '', fontes: [], areas: [] }

  test('até 7 dias pega só o que fecha na semana', () => {
    const r = filtrar(lista, { ...vazio, prazo: '7' }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['urgente'])
  })

  test('até 30 dias inclui o de 7 — as faixas são cumulativas', () => {
    const r = filtrar(lista, { ...vazio, prazo: '30' }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['urgente', 'mes'])
  })

  test('sem prazo isola exatamente quem não tem data', () => {
    const r = filtrar(lista, { ...vazio, prazo: 'sem' }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['sem'])
  })

  test('sem faixa devolve tudo', () => {
    expect(filtrar(lista, { ...vazio, prazo: null }, AGORA)).toHaveLength(4)
  })
})

describe('filtrar por múltiplos órgãos', () => {
  const lista = [
    edital({ id: 'a', fonte: 'finep' }),
    edital({ id: 'b', fonte: 'cnpq' }),
    edital({ id: 'c', fonte: 'capes' }),
  ]
  const base = { busca: '', areas: [], prazo: null }

  test('lista vazia de órgãos não filtra nada', () => {
    expect(filtrar(lista, { ...base, fontes: [] }, AGORA)).toHaveLength(3)
  })

  test('vários órgãos se combinam como OU', () => {
    const r = filtrar(lista, { ...base, fontes: ['finep', 'capes'] }, AGORA)
    expect(r.map((e) => e.id)).toEqual(['a', 'c'])
  })
})

describe('contarFacetas', () => {
  const lista = [
    edital({ id: 'a', fonte: 'finep', areas: ['saude'] }),
    edital({ id: 'b', fonte: 'cnpq', areas: ['saude'] }),
    edital({ id: 'c', fonte: 'cnpq', areas: ['agro'] }),
  ]
  const vazio = { busca: '', fontes: [], areas: [], prazo: null }

  test('sem filtro conta o dataset inteiro', () => {
    const c = contarFacetas(lista, vazio, AGORA)
    expect(c.fontes.cnpq).toBe(2)
    expect(c.fontes.finep).toBe(1)
    expect(c.areas.saude).toBe(2)
  })

  // Se a contagem de um órgão respeitasse o próprio filtro de órgão, todos os
  // não-selecionados mostrariam zero e a barra viraria um beco sem saída.
  test('a contagem de órgãos ignora o filtro de órgão', () => {
    const c = contarFacetas(lista, { ...vazio, fontes: ['finep'] }, AGORA)
    expect(c.fontes.cnpq).toBe(2)
    expect(c.fontes.finep).toBe(1)
  })

  test('mas a contagem de órgãos respeita o filtro de área', () => {
    const c = contarFacetas(lista, { ...vazio, areas: ['agro'] }, AGORA)
    expect(c.fontes.cnpq).toBe(1)
    expect(c.fontes.finep ?? 0).toBe(0)
  })

  test('a contagem de áreas ignora o filtro de área e respeita o de órgão', () => {
    const c = contarFacetas(lista, { ...vazio, fontes: ['cnpq'], areas: ['saude'] }, AGORA)
    expect(c.areas.saude).toBe(1)
    expect(c.areas.agro).toBe(1)
  })

  test('a busca vale para todas as facetas', () => {
    const comTitulo = [
      edital({ id: 'a', fonte: 'finep', titulo: 'Endometriose', areas: ['saude'] }),
      edital({ id: 'b', fonte: 'cnpq', titulo: 'Milho', areas: ['agro'] }),
    ]
    const c = contarFacetas(comTitulo, { ...vazio, busca: 'endometriose' }, AGORA)
    expect(c.fontes.finep).toBe(1)
    expect(c.fontes.cnpq ?? 0).toBe(0)
    expect(c.areas.agro ?? 0).toBe(0)
  })

  test('conta as faixas de prazo ignorando a faixa selecionada', () => {
    const comPrazo = [
      edital({ id: 'urgente', inscricaoFim: '2026-07-24T23:59:59.000Z' }),
      edital({ id: 'mes', inscricaoFim: '2026-08-14T23:59:59.000Z' }),
      edital({ id: 'sem' }),
    ]
    const c = contarFacetas(comPrazo, { ...vazio, prazo: '7' }, AGORA)
    expect(c.prazos['7']).toBe(1)
    expect(c.prazos['30']).toBe(2)
    expect(c.prazos.sem).toBe(1)
  })
})
