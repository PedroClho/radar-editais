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

// "Novo" é relativo à última visita de QUEM OLHA, não a uma janela fixa:
// devolve a visita anterior e registra a atual. Primeira visita → null,
// nada é marcado como novo.
export function registrarVisita(agoraIso: string): string | null {
  try {
    const anterior = localStorage.getItem(CHAVE_ULTIMA_VISITA)
    localStorage.setItem(CHAVE_ULTIMA_VISITA, agoraIso)
    return anterior
  } catch {
    return null
  }
}
