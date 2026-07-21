export const CHAVE_AREAS = 'radar:areas'
export const CHAVE_ULTIMA_VISITA = 'radar:ultimaVisita'

// Nunca deixar preferência corrompida derrubar a página: no pior caso
// o usuário volta a ver tudo, que é o estado de primeira visita.
export function lerAreas(areasValidas?: readonly string[]): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE_AREAS)
    if (!bruto) return []
    const valor: unknown = JSON.parse(bruto)
    if (!Array.isArray(valor)) return []
    const lista = valor.filter((v): v is string => typeof v === 'string')
    if (!areasValidas) return lista
    // Área que sumiu do dicionário viraria filtro invisível: ativa em
    // filtrar(), mas sem nenhum botão marcado na barra. Saneia e persiste.
    const validas = lista.filter((a) => areasValidas.includes(a))
    if (validas.length !== lista.length) salvarAreas(validas)
    return validas
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

// "Novo" é relativo ao último DIA de visita de quem olha, não ao último
// mount: um reload (ou segunda aba) no mesmo dia não pode apagar os badges.
// Guarda { atual, anterior }: quando a visita é de um dia novo, a atual vira
// anterior; dentro do mesmo dia nada muda. Primeira visita → null.
export function registrarVisita(
  agoraIso: string,
  mesmoDia: (a: string, b: string) => boolean,
): string | null {
  try {
    const bruto = localStorage.getItem(CHAVE_ULTIMA_VISITA)
    let atual: string | null = null
    let anterior: string | null = null
    if (bruto) {
      try {
        const v: unknown = JSON.parse(bruto)
        if (v && typeof v === 'object') {
          const o = v as { atual?: unknown; anterior?: unknown }
          if (typeof o.atual === 'string') atual = o.atual
          if (typeof o.anterior === 'string') anterior = o.anterior
        }
      } catch {
        // formato antigo: string ISO pura
        atual = bruto
      }
    }
    if (!atual || !mesmoDia(atual, agoraIso)) {
      anterior = atual
      atual = agoraIso
    }
    localStorage.setItem(
      CHAVE_ULTIMA_VISITA,
      JSON.stringify({ atual, anterior }),
    )
    return anterior
  } catch {
    return null
  }
}
