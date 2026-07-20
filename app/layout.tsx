import type { Metadata } from 'next'
import { Archivo, Newsreader } from 'next/font/google'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
})

// Serifada nos títulos: edital é documento, e a voz editorial é o oposto
// do sans genérico que todo dashboard gerado por IA usa.
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
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
      className={`${archivo.variable} ${newsreader.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  )
}
