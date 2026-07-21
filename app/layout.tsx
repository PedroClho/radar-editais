import type { Metadata, Viewport } from 'next'
import { Archivo, Newsreader } from 'next/font/google'
import { urlBase } from '@/lib/site'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
})

// Serifada nos títulos: edital é documento, e a voz editorial é o oposto
// do sans genérico que todo dashboard gerado por IA usa. O itálico é usado
// nos cabeçalhos de grupo ("Esta semana", ...).
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
})

const TITULO = 'Radar de Editais — fomento à pesquisa e inovação'
const DESCRICAO =
  'Editais de fomento abertos agora (FINEP, CNPq, FAPEG, CAPES), rotulados por área e com destaque para IA. Atualizado diariamente.'

export const metadata: Metadata = {
  metadataBase: urlBase(),
  title: TITULO,
  description: DESCRICAO,
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Radar de Editais',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRICAO,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfa' },
    { media: '(prefers-color-scheme: dark)', color: '#121316' },
  ],
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
