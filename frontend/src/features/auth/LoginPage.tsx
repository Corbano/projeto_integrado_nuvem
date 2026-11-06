import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Check, CircleX, Eye, EyeOff, Info, LockKeyhole, Mail } from 'lucide-react'
import { ApiError } from '../../shared/api/errors'
import { Button, Card, Field, GEAR_PATH, Input, Logo, Plate } from '../../shared/ui'
import type { LoginState } from './RequireAuth'
import { useAuth } from './useAuth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// A entrada toca só na primeira carga da página.
let entrancePlayed = false

const BENEFITS = [
  'Ordens de serviço do orçamento à entrega',
  'Histórico completo de cada veículo pela placa',
  'Manutenção preventiva com aviso antes de vencer',
]

function safeDestination(from: string | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/entrar')) return '/'
  return from
}

/** Engrenagens grandes e recortadas no canto do painel: só textura, na paleta. */
function PanelDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 24 24" className="absolute -right-56 -bottom-56 size-[620px]">
        <path d={GEAR_PATH} fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="0.09" />
        <circle cx="12" cy="12" r="5.6" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="0.09" />
        <circle cx="12" cy="12" r="2.4" fill="none" stroke="var(--color-menta)" strokeOpacity="0.22" strokeWidth="0.09" />
      </svg>
      <div className="absolute -top-24 -left-24 size-72 rounded-full border border-white/[0.06]" />
      <div className="absolute -top-8 -left-8 size-40 rounded-full border border-white/[0.06]" />
    </div>
  )
}

/** Ilustração do que o sistema faz (placa + próximo serviço), sem dados reais. */
function ServicePreview() {
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-[360px] rounded-card bg-superficie p-4 text-tinta shadow-[0_24px_48px_rgba(4,8,30,0.35)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-mini font-semibold">Revisão programada</p>
          <p className="text-legenda text-tinta-suave">Hatch 1.0 · 47.820 km</p>
        </div>
        <Plate value="BRA2E19" size="sm" />
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-controle bg-atencao-fundo px-3 py-2 text-mini font-medium text-atencao-texto">
        <span className="size-2 shrink-0 rounded-full bg-atencao" />
        Próximo serviço: troca de óleo em 1.200&nbsp;km
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-pilula bg-linha">
          <div className="h-full w-[82%] rounded-pilula bg-azul" />
        </div>
        <span className="text-legenda font-semibold text-tinta-suave tabular-nums">82%</span>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { status, login } = useAuth()
  const location = useLocation()
  const state = (location.state ?? {}) as LoginState
  const destination = safeDestination(state.from)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  const enter = (cls: string) => (animate ? cls : '')

  return (
    <div className="min-h-screen bg-fundo min-[900px]:grid min-[900px]:grid-cols-[minmax(0,11fr)_minmax(0,12fr)]">
      {/* Painel da marca: coluna inteira no desktop, faixa compacta no mobile. */}
      <aside className="relative isolate overflow-hidden bg-navy text-white min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-screen">
        <PanelDecor />
        <div className="relative flex h-full flex-col px-6 pt-6 pb-20 min-[900px]:px-12 min-[900px]:py-10 xl:px-16 xl:py-12">
          <Logo tone="onDark" size="md" className={enter('ac-login-panel')} />

          <p className="mt-4 max-w-[36ch] text-corpo text-white/75 min-[900px]:hidden">
            Gestão da oficina: ordens de serviço, veículos e manutenção preventiva.
          </p>

          <div className="hidden flex-1 flex-col justify-center py-10 min-[900px]:flex">
            <h2
              className={`max-w-[15ch] text-[34px] leading-[1.12] font-bold tracking-[-0.025em] text-white xl:text-marca ${enter('ac-login-panel-2')}`}
            >
              A oficina inteira, do check-in à entrega.
            </h2>
            <p className={`mt-4 max-w-[42ch] text-destaque text-white/75 ${enter('ac-login-panel-2')}`}>
              Recepção, mecânicos e gestão trabalhando sobre o mesmo histórico de cada carro.
            </p>
            <ul className={`mt-8 flex flex-col gap-3.5 ${enter('ac-login-panel-3')}`}>
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 text-destaque font-medium text-white">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-menta/15 text-menta"
                  >
                    <Check size={15} strokeWidth={2.5} />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
            <div className={`mt-12 ${enter('ac-login-panel-3')}`}>
              <ServicePreview />
            </div>
          </div>

          <p className="hidden text-mini text-white/60 min-[900px]:block">Acesso restrito à equipe da oficina.</p>
        </div>
      </aside>

      <main className="relative flex justify-center px-4 pb-10 min-[900px]:items-center min-[900px]:px-10 min-[900px]:py-12">
        <div className={`-mt-14 w-full max-w-[440px] min-[900px]:mt-0 ${enter('ac-login-card')}`}>
          <Card className="p-6 sm:p-9">
            <h1 className="text-titulo font-bold tracking-[-0.02em] text-navy">Entrar</h1>
            <p className="mt-1.5 text-corpo text-tinta-suave">
              Use o e-mail e a senha cadastrados pelo administrador da oficina.
            </p>

            {state.expired && (
              <p className="mt-5 flex items-start gap-2.5 rounded-controle bg-info-fundo px-3.5 py-3 text-corpo text-tinta">
                <Info aria-hidden="true" size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-azul" />
                Sua sessão terminou. Entre de novo para continuar.
              </p>
            )}

            <form noValidate onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5">
              <Field label="E-mail" error={errors.email}>
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="nome@empresa.com.br"
                  autoFocus
                  leadingIcon={<Mail strokeWidth={1.75} />}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Senha" error={errors.password}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  leadingIcon={<LockKeyhole strokeWidth={1.75} />}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((shown) => !shown)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                      className="inline-flex size-9 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-fundo hover:text-tinta"
                    >
                      {showPassword ? (
                        <EyeOff aria-hidden="true" size={18} strokeWidth={1.75} />
                      ) : (
                        <Eye aria-hidden="true" size={18} strokeWidth={1.75} />
                      )}
                    </button>
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>

              {formError && (
                <p
                  role="alert"
                  className="flex items-start gap-2.5 rounded-controle bg-critico-fundo px-3.5 py-3 text-corpo font-medium text-critico-texto"
                >
                  <CircleX aria-hidden="true" size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  {formError}
                </p>
              )}

              <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
                Entrar
              </Button>
            </form>

            <p className="mt-6 border-t border-linha pt-5 text-center text-mini text-tinta-suave">
              Esqueceu a senha? Peça ao administrador para redefinir.
            </p>
          </Card>
          <p className="mt-6 text-center text-legenda text-tinta-suave">Auto Center · Gestão de oficina</p>
        </div>
      </main>
    </div>
  )
}
