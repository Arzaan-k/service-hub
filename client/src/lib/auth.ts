const AUTH_KEY = "auth_token";
const USER_KEY = "current_user";

export function saveAuth(token: string, user: any) {
  localStorage.setItem(AUTH_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_KEY);
}

export function getCurrentUser(): any | null {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
