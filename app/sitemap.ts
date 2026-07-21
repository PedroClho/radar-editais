import type { MetadataRoute } from 'next'
import dadosJson from '@/data/editais.json'
import { urlBase } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: urlBase().toString(),
      lastModified: dadosJson.atualizadoEm,
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
