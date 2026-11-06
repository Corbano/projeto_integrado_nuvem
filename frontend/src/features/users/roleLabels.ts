import type { Role } from '../../shared/api/types'
import type { StatusTone } from '../../shared/ui'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  reception: 'Recepção',
  mechanic: 'Mecânico',
}

/** Tom da pílula de perfil: o administrador se destaca; os demais ficam neutros (o texto diz qual é). */
export const ROLE_TONES: Record<Role, StatusTone> = {
  admin: 'info',
  reception: 'neutral',
  mechanic: 'neutral',
}

export const ROLE_OPTIONS: Role[] = ['admin', 'reception', 'mechanic']
