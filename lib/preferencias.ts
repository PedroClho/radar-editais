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
