let _token = localStorage.getItem('auth_token') || null

export function setToken(token) {
  _token = token
  localStorage.setItem('auth_token', token)
}

export function clearCredentials() {
  _token = null
  localStorage.removeItem('auth_token')
  sessionStorage.removeItem('auth') // clear legacy sessionStorage
}

export function hasCredentials() {
  return _token !== null
}

export async function apiDownload(path, filename) {
  const res = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${_token}` },
  })
  if (res.status === 401) { clearCredentials(); throw Object.assign(new Error('Unauthorized'), { status: 401 }) }
  if (!res.ok) throw new Error(await res.text())
  const url = URL.createObjectURL(await res.blob())
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${_token}`,
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
