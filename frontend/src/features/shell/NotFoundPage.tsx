import { SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../shared/ui'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { useAuth } from '../auth/useAuth'
import { AppShell } from './AppShell'

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada')
  return (
    <>
      <PageHeader title="Página não encontrada" subtitle="O endereço não existe ou foi movido." />
      <EmptyState
        icon={<SearchX strokeWidth={1.75} />}
        title="Não achamos o que você procurou"
        description="Confira o endereço ou volte ao início para escolher uma funcionalidade."
        action={
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-controle border border-azul bg-azul px-4 text-corpo font-semibold text-white hover:border-azul-escuro hover:bg-azul-escuro"
          >
            Voltar ao início
          </Link>
        }
      />
    </>
  )
}

/** Rota curinga: dentro do shell para quem está autenticado, página simples para os demais. */
export function NotFoundRoute() {
  const { status } = useAuth()
  if (status === 'authenticated') {
    return (
      <AppShell>
        <NotFoundPage />
      </AppShell>
    )
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <NotFoundPage />
    </main>
  )
}
