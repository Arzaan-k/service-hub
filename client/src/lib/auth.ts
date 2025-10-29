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

// Initialize test user for development
export function initTestAuth() {
  if (process.env.NODE_ENV === 'development' && !getAuthToken()) {
    const testToken = 'test-admin-123';
    const testUser = {
      id: 'test-admin-123',
      name: 'Test Admin',
      role: 'admin',
      isActive: true
    };

    localStorage.setItem('auth_token', testToken);
    localStorage.setItem('current_user', JSON.stringify(testUser));
    console.log('[AUTH] Initialized test user for development');
  }
}
