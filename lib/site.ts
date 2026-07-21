// URL pública do site, resolvida no build. Na Vercel,
// VERCEL_PROJECT_PRODUCTION_URL aponta para o domínio de produção do
// projeto; fora dela (dev, CI), cai no localhost.
export function urlBase(): URL {
  const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return new URL(producao ? `https://${producao}` : 'http://localhost:3000')
}
