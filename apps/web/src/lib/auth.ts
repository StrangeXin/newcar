import Cookies from 'js-cookie';

export const TOKEN_KEY = 'newcar_token';

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function setToken(token: string): void {
  Cookies.set(TOKEN_KEY, token, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: 7,
  });
}

export function clearToken(): void {
  Cookies.remove(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}
