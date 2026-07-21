import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt =
  'Radar de Editais — editais de fomento abertos, atualizados diariamente'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Gerada no build (rota estática): o card que aparece quando alguém manda o
// link no WhatsApp da turma. Mesma linguagem do site — Newsreader, ocre,
// fundo de papel, a marca do radar.
export default async function Image() {
  const [newsreader, archivo] = await Promise.all([
    readFile(join(process.cwd(), 'assets', 'newsreader-500.ttf')),
    readFile(join(process.cwd(), 'assets', 'archivo-400.ttf')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#fbfbfa',
          padding: 72,
        }}
      >
        <svg width="96" height="96" viewBox="0 0 32 32">
          <g fill="none" stroke="#a86f00" strokeWidth="2.5" strokeLinecap="round">
            <path d="M 7 17 A 8 8 0 0 1 15 25" />
            <path d="M 7 11 A 14 14 0 0 1 21 25" />
          </g>
          <circle fill="#a86f00" cx="7" cy="25" r="2.6" />
          <circle fill="#a86f00" cx="23" cy="9" r="2.2" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontFamily: 'Newsreader',
              fontSize: 84,
              color: '#17181c',
              lineHeight: 1.05,
            }}
          >
            Radar de Editais
          </div>
          <div
            style={{
              fontFamily: 'Archivo',
              fontSize: 32,
              color: '#62666d',
              lineHeight: 1.4,
            }}
          >
            Editais de fomento abertos agora — FINEP, CNPq, FAPEG e CAPES —
            organizados pelo prazo. Atualizado todo dia.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Newsreader', data: newsreader, weight: 500, style: 'normal' },
        { name: 'Archivo', data: archivo, weight: 400, style: 'normal' },
      ],
    },
  )
}
