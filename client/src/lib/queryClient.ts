import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const getAuthTokenResult = getAuthToken();
  const localStorageAuthToken = localStorage.getItem('auth_token');
  const localStorageAuthTokenAlt = localStorage.getItem('authToken');
  const token = getAuthTokenResult || localStorageAuthToken || localStorageAuthTokenAlt;

  console.log(`[API REQUEST DEBUG] ${method} ${url}`, {
    getAuthTokenResult,
    localStorageAuthToken,
    localStorageAuthTokenAlt,
    finalToken: token,
    url,
    isRagQuery: url.includes('/api/rag/query')
  });

  // Allow test tokens in development - server will handle fallback
  // Removed aggressive token clearing that was causing issues

  const headers: Record<string, string> = {};

  // Only set Content-Type for non-FormData requests
  // FormData will set its own Content-Type with boundary
  if (data && !(data instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["x-user-id"] = token;
    console.log(`[API HEADERS SET] Setting x-user-id header to: ${token}`);
  } else {
    console.log(`[API HEADERS WARNING] No token available for ${method} ${url}`);
  }

  console.log(`[API FINAL HEADERS] ${method} ${url}`, headers);

  const getBaseUrl = () => {
    // For API requests, always use the backend URL
    // In development, backend runs on port 5000
    // In production, frontend and backend are served from the same origin
    if (process.env.NODE_ENV === 'development') {
      return ''; // Use relative path to leverage Vite proxy
    }

    // In production, use the same origin as the frontend
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin;
    }

    // Fallback to environment variables
    if (process.env.FRONTEND_URL) {
      return process.env.FRONTEND_URL;
    }

    // Default fallback
    return '';
  };

  const baseUrl = getBaseUrl();

  // Construct full URL
  let fullUrl: string;
  if (url.startsWith('http')) {
    fullUrl = url;
  } else {
    // Ensure we have proper base URL and endpoint format
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    fullUrl = `${normalizedBaseUrl}${normalizedUrl}`;
  }

  console.log(`[API] ${method} ${fullUrl}`);

  let res: Response;
try {
  res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
    credentials: "include",
  });
} catch (fetchError) {
  console.error(`[API] Network error ${method} ${fullUrl}:`, fetchError);
  throw new Error(`Network error: Unable to ${method} ${fullUrl}. Please check your connection and ensure the server is running.`);
}

  console.log(`[API Response] ${method} ${fullUrl}`, { status: res.status, statusText: res.statusText });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const token = getAuthToken() || localStorage.getItem('auth_token') || localStorage.getItem('authToken');

      // Allow test tokens in development - server will handle fallback
      // Removed aggressive token clearing that was causing issues

      const headers: Record<string, string> = {};

      if (token) {
        headers["x-user-id"] = token;
      }

      const getBaseUrl = () => {
        // Try to get from window first
        if (typeof window !== 'undefined' && window.location.origin) {
          return window.location.origin;
        }

        // Fallback to environment variables
        if (process.env.FRONTEND_URL) {
          return process.env.FRONTEND_URL;
        }

        // Default fallbacks
        return '';
      };

      console.log('[DEBUG] Query key:', queryKey);
      const baseUrl = getBaseUrl();
      console.log('[DEBUG] Base URL:', baseUrl);

      // Handle different types of query keys
      let endpoint: string;
      if (Array.isArray(queryKey)) {
        // Convert array to path, but handle special cases
        if (queryKey.length === 1 && queryKey[0].startsWith('/api/')) {
          endpoint = queryKey[0];
        } else {
          const joined = queryKey.join("/");
          endpoint = joined.startsWith('/') ? joined : `/${joined}`;
        }
      } else {
        endpoint = queryKey as unknown as string;
      }

      console.log('[DEBUG] Endpoint:', endpoint);

      // Construct full URL
      let fullQueryUrl: string;
      if (endpoint.startsWith('http')) {
        fullQueryUrl = endpoint;
      } else {
        // Ensure we have proper base URL and endpoint format
        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        fullQueryUrl = `${normalizedBaseUrl}${normalizedEndpoint}`;
      }

      console.log('[API Request]', { url: fullQueryUrl, headers: { ...headers, 'x-user-id': '[HIDDEN]' } });

      let res: Response;
      try {
        res = await fetch(fullQueryUrl, {
          headers,
          credentials: "include",
        });
      } catch (fetchError) {
        console.error(`[API] Network error fetching ${fullQueryUrl}:`, fetchError);
        throw new Error(`Network error: Unable to connect to ${fullQueryUrl}. Please check your connection and ensure the server is running.`);
      }

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // Always refetch
      retry: 3,
    },
    mutations: {
      retry: false,
    },
  },
});
