/* eslint-disable react-refresh/only-export-components -- placeholders temporários até F4/F5 */
import { createBrowserRouter, createMemoryRouter } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { RequireRole } from '../features/auth/RequireRole'
import { useAuth } from '../features/auth/useAuth'
import { NotFoundPage } from '../features/shell/NotFoundPage'

// Placeholders: F4 troca por AppShell + HomePage e F5 por UsersPage.
function HomePlaceholder() {
  const { user, logout } = useAuth()
  return (
    <main className="p-8">
      <h1 className="text-titulo">Início</h1>
      <p className="mt-2 text-corpo">Olá, {user?.name}.</p>
      <button type="button" onClick={logout} className="mt-4 text-corpo font-semibold text-esmalte underline">
        Sair
      </button>
    </main>
  )
}

function UsersPlaceholder() {
  return (
    <main className="p-8">
      <h1 className="text-titulo">Usuários</h1>
    </main>
  )
}

export const routes: RouteObject[] = [
  { path: '/entrar', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <HomePlaceholder /> },
      {
        element: <RequireRole roles={['admin']} />,
        children: [{ path: '/usuarios', element: <UsersPlaceholder /> }],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export function createAppRouter(initialEntries?: string[]) {
  return initialEntries ? createMemoryRouter(routes, { initialEntries }) : createBrowserRouter(routes)
}
