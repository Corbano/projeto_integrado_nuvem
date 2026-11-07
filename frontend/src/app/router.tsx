import { createBrowserRouter, createMemoryRouter } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { RequireRole } from '../features/auth/RequireRole'
import { AppShell } from '../features/shell/AppShell'
import { HomePage } from '../features/shell/HomePage'
import { NotFoundRoute } from '../features/shell/NotFoundPage'
import { CustomerDetailPage } from '../features/customers/CustomerDetailPage'
import { CustomersPage } from '../features/customers/CustomersPage'
import { OrderDetailPage } from '../features/orders/OrderDetailPage'
import { OrdersPage } from '../features/orders/OrdersPage'
import { VehicleDetailPage } from '../features/vehicles/VehicleDetailPage'
import { VehiclesPage } from '../features/vehicles/VehiclesPage'
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
            element: <RequireRole roles={['admin', 'reception', 'mechanic']} />,
            children: [
              { path: '/clientes', element: <CustomersPage /> },
              { path: '/clientes/:id', element: <CustomerDetailPage /> },
              { path: '/veiculos', element: <VehiclesPage /> },
              { path: '/veiculos/:id', element: <VehicleDetailPage /> },
              { path: '/ordens-de-servico', element: <OrdersPage /> },
              { path: '/ordens-de-servico/:id', element: <OrderDetailPage /> },
            ],
          },
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
