import { BellRing, Car, ClipboardCheck, Contact, House, Package, Users, Wallet, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '../../shared/api/types'
import type { AccentColor } from '../../shared/ui'

export type NavGroupId = 'operacao' | 'gestao' | 'administracao'

export interface AppModule {
  id: string
  title: string
  /** Uma linha, mostrada no card e na paleta de comandos. */
  description: string
  /** Três capacidades reais do módulo (lista com check no card). */
  bullets: readonly [string, string, string]
  route: string
  icon: LucideIcon
  accent: AccentColor
  roles: readonly Role[]
  /** false = ainda sem backend: aparece como "Em breve", sem link. */
  available: boolean
  group: NavGroupId
}

const ALL_ROLES: readonly Role[] = ['admin', 'reception', 'mechanic']

/** Fonte única dos módulos: barra lateral, cards da Início, paleta de comandos e título da página. */
export const MODULES: readonly AppModule[] = [
  {
    id: 'usuarios',
    title: 'Usuários',
    description: 'Contas da equipe e perfis de acesso',
    bullets: [
      'Perfis de administrador, recepção e mecânico',
      'Criação e edição de contas da equipe',
      'Ativação e desativação de acessos',
    ],
    route: '/usuarios',
    icon: Users,
    accent: 'azul',
    roles: ['admin'],
    available: true,
    group: 'administracao',
  },
  {
    id: 'clientes',
    title: 'Clientes',
    description: 'Cadastro e histórico de clientes',
    bullets: [
      'Cadastro com contato e documento',
      'Busca por nome, telefone ou CPF',
      'Histórico de atendimentos por cliente',
    ],
    route: '/clientes',
    icon: Contact,
    accent: 'menta',
    roles: ALL_ROLES,
    available: false,
    group: 'gestao',
  },
  {
    id: 'veiculos',
    title: 'Veículos',
    description: 'Carros, placas e quilometragem',
    bullets: [
      'Placa, modelo, ano e quilometragem',
      'Vínculo com o cliente proprietário',
      'Histórico de serviços do veículo',
    ],
    route: '/veiculos',
    icon: Car,
    accent: 'violeta',
    roles: ALL_ROLES,
    available: false,
    group: 'gestao',
  },
  {
    id: 'checkin',
    title: 'Check-in',
    description: 'Entrada e inspeção do veículo',
    bullets: [
      'Registro de entrada com quilometragem',
      'Inspeção por itens com semáforo',
      'Avarias marcadas no diagrama do carro',
    ],
    route: '/check-in',
    icon: ClipboardCheck,
    accent: 'ciano',
    roles: ['admin', 'reception'],
    available: false,
    group: 'operacao',
  },
  {
    id: 'ordens',
    title: 'Ordens de serviço',
    description: 'Serviços do pedido à entrega',
    bullets: [
      'Quadro por etapa, de aberta a concluída',
      'Peças e mão de obra em cada ordem',
      'Mecânico responsável e valor total',
    ],
    route: '/ordens-de-servico',
    icon: Wrench,
    accent: 'azul',
    roles: ALL_ROLES,
    available: false,
    group: 'operacao',
  },
  {
    id: 'estoque',
    title: 'Estoque',
    description: 'Peças, insumos e estoque mínimo',
    bullets: [
      'Entradas e saídas de peças',
      'Aviso de estoque abaixo do mínimo',
      'Peças usadas em cada ordem',
    ],
    route: '/estoque',
    icon: Package,
    accent: 'menta',
    roles: ['admin', 'reception'],
    available: false,
    group: 'gestao',
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    description: 'Receitas, pagamentos e resumo do mês',
    bullets: [
      'Receitas por ordem de serviço',
      'Formas de pagamento recebidas',
      'Resumo mensal de faturamento',
    ],
    route: '/financeiro',
    icon: Wallet,
    accent: 'violeta',
    roles: ['admin'],
    available: false,
    group: 'gestao',
  },
  {
    id: 'alertas',
    title: 'Alertas de manutenção',
    description: 'Manutenção preventiva por km e prazo',
    bullets: [
      'Próxima troca de óleo por quilometragem',
      'Revisões e rodízio por prazo',
      'Aviso antes do vencimento',
    ],
    route: '/alertas',
    icon: BellRing,
    accent: 'ciano',
    roles: ALL_ROLES,
    available: false,
    group: 'operacao',
  },
]

/** Entrada fixa no topo da navegação e da paleta; vale para qualquer perfil. */
export const HOME_ENTRY = {
  id: 'inicio',
  title: 'Início',
  description: 'Visão geral e funcionalidades',
  route: '/',
  icon: House,
  available: true,
} as const

export const NAV_GROUPS: ReadonlyArray<{ id: NavGroupId; label: string }> = [
  { id: 'operacao', label: 'Operação' },
  { id: 'gestao', label: 'Gestão' },
  { id: 'administracao', label: 'Administração' },
]

export function modulesForRole(role: Role | undefined): AppModule[] {
  if (!role) return []
  return MODULES.filter((m) => m.roles.includes(role))
}

/** Módulo cuja rota é o início do caminho (ex.: "/usuarios/3" -> Usuários). */
export function findModuleByPath(pathname: string): AppModule | undefined {
  return MODULES.find((m) => pathname === m.route || pathname.startsWith(`${m.route}/`))
}
