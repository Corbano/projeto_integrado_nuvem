import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  Logo,
  Pagination,
  Plate,
  RowActions,
  Skeleton,
  StatusPill,
  Table,
  Td,
  TdCheckbox,
  Th,
  ThCheckbox,
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

  it('não dispara onClick com loading, marca aria-busy e mantém o foco', async () => {
    const onClick = vi.fn()
    function Harness() {
      const [loading, setLoading] = useState(false)
      return (
        <Button
          loading={loading}
          onClick={() => {
            onClick()
            setLoading(true)
          }}
        >
          Entrar
        </Button>
      )
    }
    render(<Harness />)
    const button = screen.getByRole('button', { name: /Entrar/ })
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveFocus()
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('usa disabled nativo quando desabilitado sem loading', () => {
    render(<Button disabled>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
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

  it('mescla aria-describedby, aria-invalid e required do filho', () => {
    render(
      <Field label="Senha" hint="Mínimo de 8 caracteres" error="Muito curta" required>
        <Input id="minha-senha" aria-describedby="externo" aria-invalid="false" />
      </Field>,
    )
    const input = screen.getByLabelText(/Senha/)
    expect(input).toHaveAttribute('id', 'minha-senha')
    const describedBy = (input.getAttribute('aria-describedby') ?? '').split(' ')
    expect(describedBy).toContain('externo')
    expect(describedBy).toHaveLength(3)
    expect(new Set(describedBy).size).toBe(3)
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('preserva o que é do filho quando Field não tem nada a somar', () => {
    render(
      <Field label="Nome">
        <Input aria-describedby="externo" aria-invalid required />
      </Field>,
    )
    const input = screen.getByLabelText(/Nome/)
    expect(input).toHaveAttribute('aria-describedby', 'externo')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toBeRequired()
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

describe('StatusPill (Badge)', () => {
  it.each(['ok', 'attention', 'critical', 'neutral', 'info'] as const)('renderiza %s', (variant) => {
    render(<Badge variant={variant}>Texto</Badge>)
    expect(screen.getByText('Texto')).toHaveAttribute('data-variant', variant)
  })

  it('Badge é alias de StatusPill e o ponto é decorativo', () => {
    expect(Badge).toBe(StatusPill)
    const { container } = render(<StatusPill variant="ok">Ativo</StatusPill>)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
    render(<StatusPill dot={false}>Sem ponto</StatusPill>)
    expect(screen.getByText('Sem ponto').querySelector('[aria-hidden="true"]')).toBeNull()
  })
})

describe('Button: variantes e tamanhos', () => {
  it.each(['primary', 'accent', 'dark', 'outline', 'secondary', 'danger', 'ghost'] as const)(
    'renderiza %s',
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>)
      expect(screen.getByRole('button', { name: variant })).toBeEnabled()
    },
  )

  it('loading mostra spinner decorativo e texto "Carregando" para leitores de tela', () => {
    render(
      <Button loading size="lg">
        Salvar
      </Button>,
    )
    expect(screen.getByRole('button', { name: /Salvar/ })).toHaveTextContent('SalvarCarregando')
  })
})

describe('Input com ícone', () => {
  it('mantém a ligação com o Field e o ícone é decorativo', () => {
    render(
      <Field label="E-mail" error="Obrigatório">
        <Input leadingIcon={<svg data-testid="ico" />} />
      </Field>,
    )
    const input = screen.getByLabelText('E-mail')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveClass('pl-10')
    expect(screen.getByTestId('ico').parentElement).toHaveAttribute('aria-hidden', 'true')
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

describe('Dialog: foco e inert', () => {
  function LoadingHarness() {
    const [loading, setLoading] = useState(false)
    return (
      <>
        <button>Fora</button>
        <ConfirmDialog
          open
          title="Excluir"
          loading={loading}
          onConfirm={() => setLoading(true)}
          onCancel={() => {}}
        />
      </>
    )
  }

  it('mantém o foco dentro quando o botão focado fica em loading e o Tab não sai', async () => {
    render(<LoadingHarness />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await userEvent.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await userEvent.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('puxa o foco de volta quando ele vai para fora', () => {
    render(<LoadingHarness />)
    const outside = screen.getByRole('button', { name: 'Fora' })
    act(() => outside.focus())
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
  })

  it('o Tab com o foco no body entra no dialog', async () => {
    render(<LoadingHarness />)
    act(() => (document.activeElement as HTMLElement).blur())
    await userEvent.tab()
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
  })

  it('marca inert nos irmãos enquanto aberto e restaura ao fechar', async () => {
    const { container } = render(<DialogHarness />)
    expect(container).not.toHaveAttribute('inert')
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(container).toHaveAttribute('inert')
    expect(screen.getByRole('dialog').parentElement).not.toHaveAttribute('inert')
    await userEvent.keyboard('{Escape}')
    expect(container).not.toHaveAttribute('inert')
  })

  it('prefere data-autofocus como foco inicial', () => {
    render(
      <Dialog open onClose={() => {}} title="T">
        <button>Primeiro</button>
        <button data-autofocus>Preferido</button>
      </Dialog>,
    )
    expect(screen.getByRole('button', { name: 'Preferido' })).toHaveFocus()
  })
})

describe('Dialog aninhado', () => {
  function Nested() {
    const [a, setA] = useState(true)
    const [b, setB] = useState(false)
    return (
      <>
        <Dialog open={a} onClose={() => setA(false)} title="A">
          <button onClick={() => setB(true)}>Abrir B</button>
        </Dialog>
        <Dialog open={b} onClose={() => setB(false)} title="B">
          <button>Dentro de B</button>
        </Dialog>
      </>
    )
  }

  it('Esc fecha só o de cima e o scroll lock volta só depois do último', async () => {
    render(<Nested />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir B', hidden: true }))
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
    expect(document.body.style.overflow).toBe('hidden')
    await userEvent.keyboard('{Escape}')
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'A', hidden: true })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
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
    expect(screen.getByRole('status')).not.toHaveTextContent('Falha ao salvar')
  })

  it('mantém as duas regiões vivas no DOM mesmo vazias', () => {
    render(
      <ToastProvider>
        <span />
      </ToastProvider>,
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })

  it('fecha pelo botão', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'ok' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
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
    const toast = screen.getByText('Usuário criado').closest('div') as HTMLElement
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    act(() => {
      toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Usuário criado')
    act(() => {
      toast.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
      vi.advanceTimersByTime(5100)
    })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
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
          <Tr status="inactive" statusLabel="Inativo">
            <Td>Ana</Td>
          </Tr>
        </tbody>
      </Table>,
    )
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toHaveAttribute('scope', 'col')
    expect(screen.getByRole('cell', { name: /Ana/ }).closest('tr')).toHaveAttribute('data-status', 'inactive')
    expect(screen.getByText('Inativo')).toHaveClass('sr-only')
  })

  it('coluna ordenável expõe aria-sort e chama onSort', async () => {
    const onSort = vi.fn()
    render(
      <Table>
        <thead>
          <tr>
            <Th sort="asc" onSort={onSort}>
              Nome
            </Th>
            <Th>E-mail</Th>
          </tr>
        </thead>
      </Table>,
    )
    const header = screen.getByRole('columnheader', { name: 'Nome' })
    expect(header).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: 'E-mail' })).not.toHaveAttribute('aria-sort')
    await userEvent.click(screen.getByRole('button', { name: 'Nome' }))
    expect(onSort).toHaveBeenCalledTimes(1)
  })

  it('checkbox de cabeçalho suporta estado misto', () => {
    render(
      <Table>
        <thead>
          <tr>
            <ThCheckbox indeterminate checked={false} onChange={() => {}} />
          </tr>
        </thead>
        <tbody>
          <Tr selected>
            <TdCheckbox aria-label="Selecionar Ana" checked onChange={() => {}} />
          </Tr>
        </tbody>
      </Table>,
    )
    const all = screen.getByRole('checkbox', { name: 'Selecionar todas as linhas' }) as HTMLInputElement
    expect(all.indeterminate).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Selecionar Ana' })).toBeChecked()
  })
})

describe('RowActions', () => {
  function setup() {
    const editar = vi.fn()
    const excluir = vi.fn()
    render(
      <RowActions
        label="Ana Souza"
        actions={[
          { label: 'Editar', onSelect: editar },
          { label: 'Desativar', onSelect: () => {}, disabled: true },
          { label: 'Excluir', onSelect: excluir, danger: true },
        ]}
      />,
    )
    return { editar, excluir, trigger: screen.getByRole('button', { name: 'Ações de Ana Souza' }) }
  }

  it('abre pelo clique com o foco no primeiro item e fecha com Esc devolvendo o foco', async () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Ações de Ana Souza' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('setas pulam itens desabilitados, dão a volta e Enter escolhe', async () => {
    const { excluir, trigger } = setup()
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus()
    await userEvent.keyboard('{End}{Enter}')
    expect(excluir).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('↑ no botão abre no último item; clique fora fecha', async () => {
    const { trigger } = setup()
    trigger.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toHaveFocus()
    expect(screen.getByRole('menuitem', { name: 'Desativar' })).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Última página' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeEnabled()
  })

  it('primeira/última página e "Linhas por página"', async () => {
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()
    render(
      <Pagination
        page={3}
        totalPages={7}
        onPageChange={onPageChange}
        pageSize={10}
        onPageSizeChange={onPageSizeChange}
        summary="Mostrando 21–30 de 63"
      />,
    )
    expect(screen.getByText('Mostrando 21–30 de 63')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Primeira página' }))
    expect(onPageChange).toHaveBeenLastCalledWith(1)
    await userEvent.click(screen.getByRole('button', { name: 'Última página' }))
    expect(onPageChange).toHaveBeenLastCalledWith(7)
    await userEvent.selectOptions(screen.getByLabelText('Linhas por página'), '20')
    expect(onPageSizeChange).toHaveBeenCalledWith(20)
  })

  it('sem onPageSizeChange não mostra o seletor', () => {
    render(<Pagination page={1} totalPages={1} onPageChange={() => {}} />)
    expect(screen.queryByLabelText('Linhas por página')).not.toBeInTheDocument()
  })
})

describe('EmptyState, Skeleton, Logo', () => {
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

  it('Skeleton é decorativo', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('Logo mostra o nome, inclusive só com o símbolo', () => {
    const { unmount } = render(<Logo />)
    expect(screen.getByText('Auto Center')).toBeInTheDocument()
    unmount()
    render(<Logo markOnly tone="onDark" />)
    expect(screen.getByText('Auto Center')).toHaveClass('sr-only')
  })
})

describe('Dialog variant="sheet"', () => {
  it('encosta na borda inferior, com alça e cantos de cima arredondados, mantendo o comportamento de dialog', async () => {
    function SheetHarness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir folha</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Editar usuário" variant="sheet">
            <input aria-label="Nome" />
          </Dialog>
        </>
      )
    }
    render(<SheetHarness />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir folha' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar usuário' })
    expect(dialog).toHaveAttribute('data-variant', 'sheet')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveClass('rounded-t-dialogo')
    expect(dialog.parentElement).toHaveClass('items-end')
    expect(screen.getByLabelText('Nome')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('o padrão continua centralizado', async () => {
    render(<DialogHarness />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-variant', 'center')
    expect(dialog.parentElement).toHaveClass('items-center')
  })
})
