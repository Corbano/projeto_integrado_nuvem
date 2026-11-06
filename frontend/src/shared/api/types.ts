export type Role = 'admin' | 'reception' | 'mechanic'

export interface User {
  id: number | string
  name: string
  email: string
  role: Role
  active: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface ApiErrorDetail {
  loc: Array<string | number>
  msg: string
  type: string
}

export interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    details?: ApiErrorDetail[]
  }
}
