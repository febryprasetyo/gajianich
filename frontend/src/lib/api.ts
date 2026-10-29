import { AUTH_COOKIE_NAME } from "./authCookie";
import {organizationRequests} from './access/organizationScope';

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // In browser, use relative path /api/v1 for same-origin proxy routing
    return process.env.NEXT_PUBLIC_API_URL || '/api/v1';
  }
  // Server-side rendering fallback
  return (
    process.env.INTERNAL_API_URL ||
    (process.env.NEXT_PUBLIC_API_URL?.startsWith("http") ? process.env.NEXT_PUBLIC_API_URL : undefined) ||
    'http://127.0.0.1:5000/api/v1'
  );
};

export interface ApiOptions extends RequestInit {
  headers?: Record<string, string>;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Try localStorage first
  try {
    const localToken = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (localToken) return localToken;
  } catch {
    // Ignore storage errors in test / iframe environments
  }

  // Fallback to cookie search
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAME}=`))?.split('=');
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const scope=endpoint.includes('/auth/')?null:organizationRequests.begin(options.signal);
  try {
  const token = getToken();
  const baseUrl = getBaseUrl().replace(/\/+$/, '');

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if(scope?.groupId!==null && scope?.groupId!==undefined) headers['X-Organization-Group-Id']=String(scope.groupId);

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
    ...(scope?{signal:scope.signal}:{}),
  });
  scope?.assertCurrent();

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : null;
  scope?.assertCurrent();

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `HTTP Error ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data as T;
  }finally{scope?.finish();}
}

export const api = {
  get: <T = unknown>(endpoint: string, options?: ApiOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? (typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: ApiOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),

  upload: <T = unknown>(endpoint: string, formData: FormData, options?: ApiOptions) =>
    apiFetch<T>(endpoint, {
      method: 'POST',
      ...options,
      body: formData,
    }),

  download: async (endpoint: string, options?: ApiOptions): Promise<Blob> => {
    const scope=organizationRequests.begin(options?.signal);
    try {
    const token = getToken();
    const baseUrl = getBaseUrl().replace(/\/+$/, '');
    const headers: Record<string, string> = {
      ...(options?.headers || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if(scope.groupId!==null) headers['X-Organization-Group-Id']=String(scope.groupId);
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;

    const response = await fetch(url, {
      ...options,
      method: 'GET',
      headers,
      signal:scope.signal,
    });
    scope.assertCurrent();

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.error || errJson.message) errorMessage = errJson.error || errJson.message;
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }
    const blob=await response.blob();scope.assertCurrent();return blob;
    }finally{scope.finish();}
  },
};
