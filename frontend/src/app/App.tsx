import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Providers } from './providers'
import { createAppRouter } from './router'

export default function App({ router }: { router?: ReturnType<typeof createAppRouter> }) {
  const [current] = useState(() => router ?? createAppRouter())
  return (
    <Providers>
      <RouterProvider router={current} />
    </Providers>
  )
}
