const API_BASE = '/api';

/** Get stored auth token */
export function getToken(): string | null {
  return localStorage.getItem('ams_token');
}

/** Set auth token */
export function setToken(token: string): void {
  localStorage.setItem('ams_token', token);
}

/** Clear auth token */
export function clearToken(): void {
  localStorage.removeItem('ams_token');
}

/** Get stored user */
export function getStoredUser(): any | null {
  const u = localStorage.getItem('ams_user');
  return u ? JSON.parse(u) : null;
}

export function setStoredUser(user: any): void {
  localStorage.setItem('ams_user', JSON.stringify(user));
}

/** Authenticated fetch wrapper */
export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

/** Typed GET */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

/** Typed POST */
export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

/** Typed PATCH */
export async function apiPatch<T>(path: string, body?: any): Promise<T> {
  const res = await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

/** Typed DELETE */
export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
}
