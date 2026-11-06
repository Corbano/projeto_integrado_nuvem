/**
 * Decisão: o token fica em sessionStorage (some ao fechar a aba) em vez de localStorage,
 * para reduzir a janela de exposição em computadores compartilhados de balcão.
 */
const TOKEN_KEY = 'autocenter.token'

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* sessionStorage indisponível: nada a limpar */
  }
}
