import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Badge,
  BayLine,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  Logo,
  Pagination,
  Plate,
  Skeleton,
  Table,
  Td,
  Th,
  ToastProvider,
  Tr,
  isValidPlate,
  normalizePlate,
  useToast,
} from '.'

afterEach(() => {
  vi.useRealTimers()
})

describe('Button', () => {
  it('chama onClick quando ativo', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Salvar alterações</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('não dispara onClick com loading e marca aria-busy', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Entrar
      </Button>,
    )
    const button = screen.getByRole('button', { name: /Entrar/ })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Field', () => {
  it('liga label e input e descreve ajuda e erro', () => {
    render(
      <Field label="E-mail" hint="Usado para entrar" error="E-mail já cadastrado." required>
        <Input />
      </Field>,
    )
    const input = screen.getByLabelText(/E-mail/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toBeRequired()
    expect(input).toHaveAccessibleDescription('Usado para entrar E-mail já cadastrado.')
  })

  it('sem erro não marca aria-invalid', () => {
    render(
      <Field label="Nome">
        <Input />
      </Field>,
    )
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-invalid')
  })
})

describe('Badge', () => {
  it.each(['ok', 'attention', 'critical', 'neutral', 'info'] as const)('renderiza %s', (variant) => {
    render(<Badge variant={variant}>Texto</Badge>)
    expect(screen.getByText('Texto')).toHaveAttribute('data-variant', variant)
  })
})

describe('Plate', () => {
  it('normaliza e valida', () => {
    expect(normalizePlate('abc1d23')).toBe('ABC1D23')
    expect(normalizePlate('abc-1234')).toBe('ABC-1234')
    expect(normalizePlate('abc1234')).toBe('ABC-1234')
    expect(isValidPlate('abc1d23')).toBe(true)
    expect(isValidPlate('ABC-1234')).toBe(true)
    expect(isValidPlate('AB-12345')).toBe(false)
    expect(isValidPlate('')).toBe(false)
  })

  it('renderiza o texto formatado e BRASIL', () => {
    render(<Plate value="abc1d23" />)
    expect(screen.getByText('ABC1D23')).toBeInTheDocument()
    expect(screen.getByText('BRASIL')).toBeInTheDocument()
    expect(screen.getByLabelText('Placa ABC1D23')).toHaveAttribute('data-valid', 'true')
  })

  it('não lança com entrada inválida e expõe a invalidez', () => {
    render(<Plate value="xx99" />)
    expect(screen.getByLabelText('Placa inválida: xx99')).toHaveAttribute('data-valid', 'false')
    expect(screen.getByText('xx99')).toBeInTheDocument()
    expect(screen.queryByText('BRASIL')).not.toBeInTheDocument()
  })

  it('mostra "Sem placa" quando vazia', () => {
    render(<Plate value="" />)
    expect(screen.getByLabelText('Sem placa')).toBeInTheDocument()
  })
})

function DialogHarness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Novo usuário" dismissible={dismissible}>
        <input aria-label="Nome" />
        <button>Salvar</button>
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  it('tem role dialog, aria-modal e título associado', async () => {
    render(<DialogHarness />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo usuário' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Nome')).toHaveFocus()
  })

  it('fecha com Esc e devolve o foco ao gatilho', async () => {
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Abrir' })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('prende o foco: Tab e Shift+Tab dão a volta', async () => {
    render(<DialogHarness />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.getByLabelText('Nome')).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByLabelText('Nome')).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveFocus()
  })

  it('clique no fundo fecha só se dismissible', async () => {
    const { unmount } = render(<DialogHarness />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    await userEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    render(<DialogHarness dismissible={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    await userEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('chama onConfirm e onCancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        destructive
        title="Excluir usuário"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Esc cancela', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open title="Confirmar?" onConfirm={() => {}} onCancel={onCancel} />)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

function ToastHarness() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.success('Usuário criado')}>ok</button>
      <button onClick={() => toast.error('Falha ao salvar')}>erro</button>
    </>
  )
}

describe('Toast', () => {
  it('anuncia sucesso como status e erro como alert', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'ok' }))
    expect(screen.getByRole('status')).toHaveTextContent('Usuário criado')
    await userEvent.click(screen.getByRole('button', { name: 'erro' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao salvar')
  })

  it('fecha pelo botão', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'ok' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('some sozinho após ~5s, mas pausa com o mouse em cima', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )
    act(() => {
      screen.getByRole('button', { name: 'ok' }).click()
    })
    const toast = screen.getByRole('status')
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    act(() => {
      toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => {
      toast.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
      vi.advanceTimersByTime(5100)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('useToast fora do provider falha com mensagem clara', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ToastHarness />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })
})

describe('Table', () => {
  it('Th tem scope=col e a linha expõe a barra de status', () => {
    render(
      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
          </tr>
        </thead>
        <tbody>
          <Tr status="inactive">
            <Td>Ana</Td>
          </Tr>
        </tbody>
      </Table>,
    )
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toHaveAttribute('scope', 'col')
    expect(screen.getByRole('cell', { name: 'Ana' }).closest('tr')).toHaveAttribute('data-status', 'inactive')
  })
})

describe('Pagination', () => {
  it('desabilita anterior na primeira página e mostra a informação', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={7} onPageChange={onPageChange} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    expect(screen.getByText('Página 1 de 7')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('desabilita próxima na última página', () => {
    render(<Pagination page={7} totalPages={7} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeEnabled()
  })
})

describe('EmptyState, Skeleton, Logo, BayLine', () => {
  it('dispara a ação do estado vazio', async () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="Nenhum usuário encontrado"
        description="Limpe a busca ou crie o primeiro."
        action={<Button onClick={onClick}>Criar usuário</Button>}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Nenhum usuário encontrado' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Criar usuário' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('Skeleton e BayLine são decorativos', () => {
    const { container } = render(
      <>
        <Skeleton />
        <BayLine orientation="vertical" />
      </>,
    )
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
    expect(container.querySelector('[data-orientation="vertical"]')).not.toBeNull()
  })

  it('Logo mostra o nome', () => {
    render(<Logo />)
    expect(screen.getByText('Auto Center')).toBeInTheDocument()
  })
})
