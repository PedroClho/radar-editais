import type { MetadataRoute } from 'next'

// Ferramenta de quem volta todo dia merece o atalho de tela inicial no
// celular. Só o manifest — sem service worker, sem offline.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Radar de Editais',
    short_name: 'Radar',
    description:
      'Editais de fomento abertos agora (FINEP, CNPq, FAPEG, CAPES), organizados pelo prazo.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbfbfa',
    theme_color: '#fbfbfa',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  }
}
