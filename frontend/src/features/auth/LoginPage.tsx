import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ApiError } from '../../shared/api/errors'
import { BayLine, Button, Field, Input, Logo } from '../../shared/ui'
import type { LoginState } from './RequireAuth'
import { useAuth } from './useAuth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// A entrada orquestrada toca só na primeira carga da página.
let entrancePlayed = false

function safeDestination(from: string | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/entrar')) return '/'
  return from
}

export function LoginPage() {
  const { status, login } = useAuth()
  const location = useLocation()
  const state = (location.state ?? {}) as LoginState
  const destination = safeDestination(state.from)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [animate] = useState(() => !entrancePlayed)

  useEffect(() => {
    document.title = 'Entrar · Auto Center'
    entrancePlayed = true
  }, [])

  if (status === 'authenticated') return <Navigate to={destination} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const trimmed = email.trim()
    const next: { email?: string; password?: string } = {}
    if (!trimmed) next.email = 'Informe o e-mail.'
    else if (!EMAIL_PATTERN.test(trimmed)) next.email = 'Informe um e-mail válido, como nome@empresa.com.br.'
    if (!password) next.password = 'Informe a senha.'
    setErrors(next)
    setFormError(null)
    if (next.email || next.password) return

    setSubmitting(true)
    try {
      await login(trimmed, password)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'network_error') setFormError(error.message)
      else if (error instanceof ApiError && error.status === 401) setFormError('E-mail ou senha incorretos.')
      else setFormError('Não foi possível entrar agora. Tente de novo em instantes.')
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen min-[900px]:grid-cols-[5fr_6fr]">
      <aside className="relative flex flex-col gap-4 bg-chassi p-6 text-bancada min-[900px]:justify-between min-[900px]:p-12">
        <Logo className="min-[900px]:[&>span]:text-marca" />
        <p className="hidden max-w-[34ch] text-destaque min-[900px]:block">
          Gestão de oficina: clientes, veículos, ordens de serviço e manutenção preventiva em um lugar só.
        </p>
        <BayLine
          orientation="vertical"
          className={`absolute inset-y-0 right-0 hidden min-[900px]:block ${animate ? 'ac-draw-down' : ''}`}
        />
        <BayLine className={`absolute inset-x-0 bottom-0 min-[900px]:hidden ${animate ? 'ac-draw-right' : ''}`} />
      </aside>
      <main className="flex items-center bg-bancada p-6 min-[900px]:p-12">
        <div className={`w-full max-w-sm ${animate ? 'ac-login-in' : ''}`}>
          <h1 className="text-titulo text-chassi">Entrar</h1>
          {state.expired && (
            <p className="mt-2 text-corpo text-chassi-suave">Sua sessão terminou. Entre de novo para continuar.</p>
          )}
          <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Field label="E-mail" error={errors.email}>
              <Input
                type="email"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Senha" error={errors.password}>
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            {formError && (
              <p role="alert" className="text-corpo font-medium text-freio-texto">
                {formError}
              </p>
            )}
            <Button type="submit" loading={submitting} className="w-full">
              Entrar
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
