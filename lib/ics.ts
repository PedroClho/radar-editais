import type { Edital } from '@/scraper/schema'
import { limparTitulo, normalizarCaixa } from './editais'

const DIA_MS = 86_400_000

// RFC 5545: vírgula, ponto-e-vírgula, barra invertida e quebra de linha
// precisam de escape em valores de texto.
function escaparIcs(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function dataBasica(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '')
}

function diaSeguinte(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  const seguinte = new Date(Date.UTC(ano, mes - 1, dia) + DIA_MS)
  return seguinte.toISOString().slice(0, 10).replace(/-/g, '')
}

// Evento de dia inteiro na data do prazo — depois de decidir "vou submeter",
// o lembrete na agenda pessoal é o que fecha o ciclo que a faixa de urgência
// começa. Gerado 100% no cliente, sem rede.
export function gerarIcs(edital: Edital): string | undefined {
  if (!edital.inscricaoFim) return undefined
  const inicio = dataBasica(edital.inscricaoFim)
  const titulo = normalizarCaixa(limparTitulo(edital.titulo).titulo)
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Radar de Editais//PT-BR',
    'BEGIN:VEVENT',
    `UID:${edital.id}@radar-editais`,
    `DTSTAMP:${dataBasica(edital.coletadoEm)}T000000Z`,
    `DTSTART;VALUE=DATE:${inicio}`,
    `DTEND;VALUE=DATE:${diaSeguinte(edital.inscricaoFim)}`,
    `SUMMARY:${escaparIcs(`Prazo: ${titulo}`)}`,
    `DESCRIPTION:${escaparIcs(`Fim das inscrições. Edital: ${edital.url}`)}`,
    `URL:${escaparIcs(edital.url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${linhas.join('\r\n')}\r\n`
}

export function urlIcs(edital: Edital): string | undefined {
  const ics = gerarIcs(edital)
  if (!ics) return undefined
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
}
