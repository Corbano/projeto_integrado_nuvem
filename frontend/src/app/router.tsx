import { createBrowserRouter, createMemoryRouter } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { RequireRole } from '../features/auth/RequireRole'
import { AppShell } from '../features/shell/AppShell'
import { HomePage } from '../features/shell/HomePage'
import { NotFoundRoute } from '../features/shell/NotFoundPage'
import { UsersPage } from '../features/users/UsersPage'

export const routes: RouteObject[] = [
  { path: '/entrar', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
          {
            element: <RequireRole roles={['admin']} />,
            children: [{ path: '/usuarios', element: <UsersPage /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundRoute /> },
]

export function createAppRouter(initialEntries?: string[]) {
  return initialEntries ? createMemoryRouter(routes, { initialEntries }) : createBrowserRouter(routes)
}
