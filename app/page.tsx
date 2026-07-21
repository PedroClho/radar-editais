import Radar from '@/componentes/Radar'
import dadosJson from '@/data/editais.json'
import { DadosSchema } from '@/scraper/schema'

// O pipeline é 100% automatizado (Actions escreve o JSON, Vercel builda sem
// revisão humana): validar aqui faz um dado malformado quebrar o BUILD com
// mensagem clara, em vez de virar crash no navegador de quem visita.
const dados = DadosSchema.parse(dadosJson)

export default function Home() {
  return <Radar dados={dados} />
}
