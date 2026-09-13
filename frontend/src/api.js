let _b64 = sessionStorage.getItem('auth') || null

export function setCredentials(username, password) {
  _b64 = btoa(`${username}:${password}`)
  sessionStorage.setItem('auth', _b64)
}

export function clearCredentials() {
  _b64 = null
  sessionStorage.removeItem('auth')
}

export function hasCredentials() {
  return _b64 !== null
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      Authorization: `Basic ${_b64}`,
      ...options.headers,
    },
  })
  if (res.status === 401) {
    clearCredentials()
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
