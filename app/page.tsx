import Dashboard from '@/componentes/Dashboard'
import dadosJson from '@/data/editais.json'
import type { Dados } from '@/scraper/schema'

const dados = dadosJson as unknown as Dados

export default function Home() {
  return <Dashboard dados={dados} />
}
