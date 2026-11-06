import { Users } from 'lucide-react'
import { EmptyState, PageHeader } from '../../shared/ui'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'

/** Espaço reservado: a F5 troca por a tabela de usuários. */
export function UsersPage() {
  useDocumentTitle('Usuários')
  return (
    <>
      <PageHeader title="Usuários" subtitle="Contas da equipe e perfis de acesso ao sistema." />
      <EmptyState
        icon={<Users strokeWidth={1.75} />}
        title="A lista de usuários chega na próxima etapa"
        description="Aqui você vai criar, editar e desativar as contas da equipe."
      />
    </>
  )
}
