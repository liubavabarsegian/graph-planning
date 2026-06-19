const TOKEN_KEY = 'gp_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// При получении 401 от любого API-запроса — сразу чистим токен и перезагружаем страницу.
export function handleUnauthorized(): void {
  clearToken()
  window.location.reload()
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const data = await res.json().catch(() => ({ error: 'Unknown error' }))
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }

  return data.token as string
}

export async function register(email: string, password: string): Promise<string> {
  const res = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const data = await res.json().catch(() => ({ error: 'Unknown error' }))
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }

  return data.token as string
}
