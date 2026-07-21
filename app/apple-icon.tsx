import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// A mesma marca do icon.svg, sobre fundo sólido — ícone de tela inicial não
// tem transparência nem media query de tema.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fbfbfa',
        }}
      >
        <svg width="128" height="128" viewBox="0 0 32 32">
          <g fill="none" stroke="#a86f00" strokeWidth="2.5" strokeLinecap="round">
            <path d="M 7 17 A 8 8 0 0 1 15 25" />
            <path d="M 7 11 A 14 14 0 0 1 21 25" />
          </g>
          <circle fill="#a86f00" cx="7" cy="25" r="2.6" />
          <circle fill="#a86f00" cx="23" cy="9" r="2.2" />
        </svg>
      </div>
    ),
    size,
  )
}
