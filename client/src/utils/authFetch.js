import { loadToken, clearToken } from './storage';

let onAuthFailure = null;

export function setAuthFailureHandler(handler) {
  onAuthFailure = handler;
}

export async function authFetch(url, options = {}) {
  const token = loadToken();
  const headers = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (onAuthFailure) onAuthFailure();
  }

  return res;
}
