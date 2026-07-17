import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: 'Radar de Editais — fomento à pesquisa e inovação',
  description:
    'Editais de fomento abertos agora (FINEP, CNPq, FAPEG, CAPES), rotulados por área e com destaque para IA. Atualizado diariamente.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${plexMono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  )
}
