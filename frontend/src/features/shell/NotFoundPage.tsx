import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="p-8">
      <h1 className="text-titulo text-tinta">Página não encontrada</h1>
      <p className="mt-2 text-corpo text-tinta-suave">O endereço não existe ou foi movido.</p>
      <Link to="/" className="mt-4 inline-block text-corpo font-semibold text-azul underline underline-offset-2">
        Voltar ao início
      </Link>
    </main>
  )
}
